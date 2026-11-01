import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createExpressApp } from '../app';
import { ensureSeededDatabase } from '../services/seedService';
import { env } from '../config/env';
import { UPLOADS_DIR } from '../middleware/upload';
import {
  Admin,
  Project,
  Service,
  About,
  Timeline,
  Testimonial,
  Skill,
  Message,
  FAQ,
  Pricing,
  SiteSettings,
  Analytics,
  MediaAsset,
} from '../models';

let mongoServer: MongoMemoryServer;
let httpServer: http.Server;
let baseUrl = '';
let superAdminToken = '';
let editorToken = '';

interface JsonResponse {
  status: number;
  headers: Headers;
  body: any;
}

async function apiRequest(
  endpoint: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): Promise<JsonResponse> {
  const headers: Record<string, string> = {
    ...(options.headers || {}),
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  let payload: BodyInit | undefined;
  if (options.body !== undefined) {
    if (options.body instanceof FormData) {
      payload = options.body;
    } else {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(options.body);
    }
  }

  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: payload,
  });

  const contentType = res.headers.get('content-type') || '';
  const parsedBody = contentType.includes('application/json')
    ? await res.json()
    : await res.text();

  return {
    status: res.status,
    headers: res.headers,
    body: parsedBody,
  };
}

before(async () => {
  mongoServer = await MongoMemoryServer.create({
    instance: { dbName: 'mahim_audit_isolated_test_db' },
  });
  await mongoose.connect(mongoServer.getUri());
  await ensureSeededDatabase(false);

  // Provision an isolated editor account to verify RBAC enforcement
  const editorHash = await bcrypt.hash('EditorPass@123', 10);
  await Admin.create({
    name: 'Audit Editor',
    email: 'editor-test@mahimdev.com',
    passwordHash: editorHash,
    role: 'editor',
  });

  const app = createExpressApp();
  httpServer = http.createServer(app);
  await new Promise<void>((resolve) => {
    httpServer.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = httpServer.address();
  if (!addr || typeof addr === 'string') {
    throw new Error('Failed to bind ephemeral integration test server');
  }
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  if (httpServer) {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

test('1. System Health, SEO Routes & Production Asset Static Serving', async () => {
  const health = await apiRequest('/api/v1/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.success, true);
  assert.equal(health.body.data.status, 'ok');

  const robots = await apiRequest('/robots.txt');
  assert.equal(robots.status, 200);
  assert.match(String(robots.body), /Disallow: \/admin/);

  const sitemap = await apiRequest('/sitemap.xml');
  assert.equal(sitemap.status, 200);
  assert.match(String(sitemap.body), /<loc>.*\/projects\/nextgen-mart<\/loc>/);

  const heroImg = await fetch(
    `${baseUrl}/src/assets/images/hero_developer_portrait_1793526368603.jpg`
  );
  assert.equal(heroImg.status, 200);
  assert.match(heroImg.headers.get('content-type') || '', /image\/jpeg/);
  assert.equal(heroImg.headers.get('x-content-type-options'), 'nosniff');

  // Verify source code files outside src/assets/images are NEVER served
  const sourceAttempt = await fetch(`${baseUrl}/src/App.tsx`);
  assert.equal(sourceAttempt.status, 404);
});

test('2. Authentication, RBAC & Session Security', async () => {
  // Invalid credentials rejected
  const badLogin = await apiRequest('/api/v1/auth/login', {
    method: 'POST',
    body: { email: env.INITIAL_ADMIN_EMAIL, password: 'WrongPassword99' },
  });
  assert.equal(badLogin.status, 401);

  // Valid superadmin login
  const login = await apiRequest('/api/v1/auth/login', {
    method: 'POST',
    body: { email: env.INITIAL_ADMIN_EMAIL, password: env.INITIAL_ADMIN_PASSWORD },
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.success, true);
  assert.ok(login.body.data.token);
  assert.equal('passwordHash' in login.body.data.admin, false);
  assert.match(login.headers.get('set-cookie') || '', /HttpOnly/i);
  superAdminToken = login.body.data.token;

  // Editor login
  const edLogin = await apiRequest('/api/v1/auth/login', {
    method: 'POST',
    body: { email: 'editor-test@mahimdev.com', password: 'EditorPass@123' },
  });
  assert.equal(edLogin.status, 200);
  editorToken = edLogin.body.data.token;

  // Unauthenticated access to protected route -> 401
  const unauthMe = await apiRequest('/api/v1/auth/me');
  assert.equal(unauthMe.status, 401);

  // Invalid JWT -> 401
  const tampered = await apiRequest('/api/v1/auth/me', { token: 'invalid.jwt.token' });
  assert.equal(tampered.status, 401);

  // Session check endpoint
  const sessionOk = await apiRequest('/api/v1/auth/session', { token: superAdminToken });
  assert.equal(sessionOk.status, 200);
  assert.equal(sessionOk.body.data.authenticated, true);

  // Update admin profile & verify MongoDB persistence
  const profUpdate = await apiRequest('/api/v1/auth/me', {
    method: 'PUT',
    token: superAdminToken,
    body: {
      name: 'Mahim Dev Verified',
      email: env.INITIAL_ADMIN_EMAIL,
      bio: 'Senior Full-Stack Engineer',
    },
  });
  assert.equal(profUpdate.status, 200);
  const dbAdmin = await Admin.findOne({ email: env.INITIAL_ADMIN_EMAIL });
  assert.equal(dbAdmin?.name, 'Mahim Dev Verified');

  // Password rotation invalidates pre-rotation tokens immediately
  const preRotationToken = superAdminToken;
  const rotateRes = await apiRequest('/api/v1/auth/change-password', {
    method: 'PUT',
    token: preRotationToken,
    body: {
      currentPassword: env.INITIAL_ADMIN_PASSWORD,
      newPassword: 'NewStrongPassword99',
    },
  });
  assert.equal(rotateRes.status, 200);
  const rotatedToken = rotateRes.body.data.token;
  assert.ok(rotatedToken);

  // Old token MUST fail with 401 PASSWORD_CHANGED
  const oldTokenAttempt = await apiRequest('/api/v1/auth/me', { token: preRotationToken });
  assert.equal(oldTokenAttempt.status, 401);
  assert.equal(oldTokenAttempt.body.error.code, 'PASSWORD_CHANGED');

  // Fresh token MUST succeed
  const freshTokenAttempt = await apiRequest('/api/v1/auth/me', { token: rotatedToken });
  assert.equal(freshTokenAttempt.status, 200);

  // Rotate back to initial password so downstream config stays consistent
  const restoreRes = await apiRequest('/api/v1/auth/change-password', {
    method: 'PUT',
    token: rotatedToken,
    body: {
      currentPassword: 'NewStrongPassword99',
      newPassword: env.INITIAL_ADMIN_PASSWORD,
    },
  });
  assert.equal(restoreRes.status, 200);
  superAdminToken = restoreRes.body.data.token;
});

test('3. Projects CRUD, Draft Visibility, Partial Update Regression & Reorder', async () => {
  // Create draft project
  const createRes = await apiRequest('/api/v1/projects', {
    method: 'POST',
    token: superAdminToken,
    body: {
      title: 'Audit Cloud Commerce',
      category: 'E-Commerce',
      shortDescription: 'Isolated integration test storefront with distributed inventory.',
      overview: 'Comprehensive architectural case study overview.',
      thumbnail: '/src/assets/images/project_nextgen_mart_1793526368603.jpg',
      technologies: ['TypeScript', 'Node.js', 'MongoDB'],
      features: ['Distributed Cart', 'Webhook Sync'],
      challenges: 'High concurrency spikes',
      solutions: 'Optimistic locking & caching',
      results: '99.99% checkout uptime',
      liveUrl: 'https://example.com/demo',
      githubUrl: 'https://github.com/example/repo',
      featured: false,
      published: false,
    },
  });
  assert.equal(createRes.status, 201);
  const projectId = createRes.body.data._id;
  const projectSlug = createRes.body.data.slug;

  // Verify real DB persistence
  const savedDoc = await Project.findById(projectId);
  assert.ok(savedDoc);
  assert.deepEqual(savedDoc.technologies, ['TypeScript', 'Node.js', 'MongoDB']);
  assert.equal(savedDoc.published, false);

  // Draft must NOT be accessible publicly
  const publicFetchDraft = await apiRequest(`/api/v1/projects/${projectSlug}`);
  assert.equal(publicFetchDraft.status, 404);

  // Draft IS accessible to authenticated admin with includeDrafts=true
  const adminList = await apiRequest('/api/v1/projects?includeDrafts=true', {
    token: superAdminToken,
  });
  assert.equal(adminList.status, 200);
  assert.ok(adminList.body.data.some((p: any) => p._id === projectId));

  // CRITICAL REGRESSION TEST: Partial PUT { featured: true } must NOT wipe omitted fields or publish draft!
  const toggleFeaturedRes = await apiRequest(`/api/v1/projects/${projectId}`, {
    method: 'PUT',
    token: superAdminToken,
    body: { featured: true },
  });
  assert.equal(toggleFeaturedRes.status, 200);

  const afterPartialDoc = await Project.findById(projectId);
  assert.ok(afterPartialDoc);
  assert.equal(afterPartialDoc.featured, true);
  assert.equal(afterPartialDoc.published, false);
  assert.equal(afterPartialDoc.overview, 'Comprehensive architectural case study overview.');
  assert.deepEqual(afterPartialDoc.technologies, ['TypeScript', 'Node.js', 'MongoDB']);
  assert.deepEqual(afterPartialDoc.features, ['Distributed Cart', 'Webhook Sync']);
  assert.equal(afterPartialDoc.liveUrl, 'https://example.com/demo');

  // Publish project & verify public view counter increments in DB
  await apiRequest(`/api/v1/projects/${projectId}`, {
    method: 'PUT',
    token: superAdminToken,
    body: { published: true },
  });
  const pubVisit = await apiRequest(`/api/v1/projects/${projectSlug}`);
  assert.equal(pubVisit.status, 200);
  const viewedDoc = await Project.findById(projectId);
  assert.equal(viewedDoc?.views, 1);

  // Reorder validation: invalid ObjectId rejected with 400
  const badReorder = await apiRequest('/api/v1/projects/reorder', {
    method: 'PUT',
    token: superAdminToken,
    body: { orderedIds: ['not-an-object-id'] },
  });
  assert.equal(badReorder.status, 400);

  const goodReorder = await apiRequest('/api/v1/projects/reorder', {
    method: 'PUT',
    token: superAdminToken,
    body: { orderedIds: [projectId] },
  });
  assert.equal(goodReorder.status, 200);
  assert.equal((await Project.findById(projectId))?.order, 1);

  // RBAC: Editor cannot DELETE project (403 FORBIDDEN)
  const editorDelete = await apiRequest(`/api/v1/projects/${projectId}`, {
    method: 'DELETE',
    token: editorToken,
  });
  assert.equal(editorDelete.status, 403);

  // Superadmin deletes project & verify removal in MongoDB
  const adminDelete = await apiRequest(`/api/v1/projects/${projectId}`, {
    method: 'DELETE',
    token: superAdminToken,
  });
  assert.equal(adminDelete.status, 200);
  assert.equal(await Project.findById(projectId), null);
});

test('4. Services, About, Timeline & CV Download CRUD Persistence', async () => {
  // Services CRUD
  const createdSvc = await apiRequest('/api/v1/services', {
    method: 'POST',
    token: superAdminToken,
    body: {
      title: 'Audit API Architecture',
      icon: 'Server',
      shortDescription: 'Resilient REST & GraphQL backends built with TypeScript.',
      features: ['Zod Validation', 'Rate Limiting'],
      startingPrice: '$1,500',
    },
  });
  assert.equal(createdSvc.status, 201);
  const svcId = createdSvc.body.data._id;
  assert.ok(await Service.findById(svcId));

  // Partial update preserves features array
  const updSvc = await apiRequest(`/api/v1/services/${svcId}`, {
    method: 'PUT',
    token: superAdminToken,
    body: { startingPrice: '$1,800' },
  });
  assert.equal(updSvc.status, 200);
  const svcDoc = await Service.findById(svcId);
  assert.equal(svcDoc?.startingPrice, '$1,800');
  assert.deepEqual(svcDoc?.features, ['Zod Validation', 'Rate Limiting']);

  const delSvc = await apiRequest(`/api/v1/services/${svcId}`, {
    method: 'DELETE',
    token: superAdminToken,
  });
  assert.equal(delSvc.status, 200);
  assert.equal(await Service.findById(svcId), null);

  // About & Timeline CRUD
  const updAbout = await apiRequest('/api/v1/about', {
    method: 'PUT',
    token: superAdminToken,
    body: { trustText: 'Verified by automated integration suite' },
  });
  assert.equal(updAbout.status, 200);
  const aboutDoc = await About.findOne();
  assert.equal(aboutDoc?.trustText, 'Verified by automated integration suite');

  const createdTl = await apiRequest('/api/v1/about/timeline', {
    method: 'POST',
    token: superAdminToken,
    body: {
      year: '2026',
      title: 'Principal Systems Audit',
      subtitle: 'Enterprise Cloud',
      description: 'Led zero-downtime architecture audit across microservices.',
      category: 'career',
    },
  });
  assert.equal(createdTl.status, 201);
  const tlId = createdTl.body.data._id;

  const updTl = await apiRequest(`/api/v1/about/timeline/${tlId}`, {
    method: 'PUT',
    token: superAdminToken,
    body: { year: '2026 - Present' },
  });
  assert.equal(updTl.status, 200);
  assert.equal((await Timeline.findById(tlId))?.subtitle, 'Enterprise Cloud');

  const cvRes = await apiRequest('/api/v1/about/cv-download');
  assert.equal(cvRes.status, 200);
  assert.match(String(cvRes.body), /CAREER TIMELINE/);

  const delTl = await apiRequest(`/api/v1/about/timeline/${tlId}`, {
    method: 'DELETE',
    token: superAdminToken,
  });
  assert.equal(delTl.status, 200);
  assert.equal(await Timeline.findById(tlId), null);
});

test('5. Testimonials, Skills, Pricing, FAQs & SiteSettings CRUD Persistence', async () => {
  // Testimonial
  const tCreate = await apiRequest('/api/v1/testimonials', {
    method: 'POST',
    token: superAdminToken,
    body: {
      clientName: 'Alex Rivera',
      company: 'CloudScale',
      position: 'CTO',
      review: 'Exceptional engineering rigor and zero-defect delivery.',
      rating: 5,
    },
  });
  assert.equal(tCreate.status, 201);
  const tId = tCreate.body.data._id;
  await apiRequest(`/api/v1/testimonials/${tId}`, {
    method: 'PUT',
    token: superAdminToken,
    body: { position: 'VP Engineering' },
  });
  assert.equal((await Testimonial.findById(tId))?.company, 'CloudScale');
  assert.equal((await Testimonial.findById(tId))?.position, 'VP Engineering');
  await apiRequest(`/api/v1/testimonials/${tId}`, { method: 'DELETE', token: superAdminToken });
  assert.equal(await Testimonial.findById(tId), null);

  // Skill
  const skCreate = await apiRequest('/api/v1/skills', {
    method: 'POST',
    token: superAdminToken,
    body: {
      name: 'Playwright Automation',
      category: 'DevOps & Tools',
      proficiency: 94,
      description: 'End-to-end verification',
    },
  });
  assert.equal(skCreate.status, 201);
  const skId = skCreate.body.data._id;
  await apiRequest(`/api/v1/skills/${skId}`, {
    method: 'PUT',
    token: superAdminToken,
    body: { proficiency: 98 },
  });
  assert.equal((await Skill.findById(skId))?.description, 'End-to-end verification');
  assert.equal((await Skill.findById(skId))?.proficiency, 98);
  await apiRequest(`/api/v1/skills/${skId}`, { method: 'DELETE', token: superAdminToken });
  assert.equal(await Skill.findById(skId), null);

  // Pricing
  const prCreate = await apiRequest('/api/v1/pricing', {
    method: 'POST',
    token: superAdminToken,
    body: {
      packageName: 'Audit Retainer',
      price: '$2,400',
      billingType: 'Monthly',
      features: ['24/7 Monitoring', 'Security Hardening'],
    },
  });
  assert.equal(prCreate.status, 201);
  const prId = prCreate.body.data._id;
  await apiRequest(`/api/v1/pricing/${prId}`, {
    method: 'PUT',
    token: superAdminToken,
    body: { price: '$2,600' },
  });
  assert.deepEqual((await Pricing.findById(prId))?.features, [
    '24/7 Monitoring',
    'Security Hardening',
  ]);
  await apiRequest(`/api/v1/pricing/${prId}`, { method: 'DELETE', token: superAdminToken });
  assert.equal(await Pricing.findById(prId), null);

  // FAQ
  const fqCreate = await apiRequest('/api/v1/faq', {
    method: 'POST',
    token: superAdminToken,
    body: {
      question: 'Do you provide automated test coverage?',
      answer: 'Yes, unit, integration, and end-to-end suites are included.',
      category: 'Engineering',
    },
  });
  assert.equal(fqCreate.status, 201);
  const fqId = fqCreate.body.data._id;
  await apiRequest(`/api/v1/faq/${fqId}`, {
    method: 'PUT',
    token: superAdminToken,
    body: { visible: false },
  });
  assert.equal((await FAQ.findById(fqId))?.category, 'Engineering');
  assert.equal((await FAQ.findById(fqId))?.visible, false);
  await apiRequest(`/api/v1/faq/${fqId}`, { method: 'DELETE', token: superAdminToken });
  assert.equal(await FAQ.findById(fqId), null);

  // Site Settings RBAC (editor blocked 403) & Partial Subdocument Merge Preservation
  const editorSettingsAttempt = await apiRequest('/api/v1/settings', {
    method: 'PUT',
    token: editorToken,
    body: { siteTitle: 'Unauthorized Change' },
  });
  assert.equal(editorSettingsAttempt.status, 403);

  const beforeSettings = await SiteSettings.findOne();
  const originalHeadline2 = beforeSettings?.banner?.headlineLine2;

  const partialBannerUpdate = await apiRequest('/api/v1/settings', {
    method: 'PUT',
    token: superAdminToken,
    body: {
      banner: { availabilityText: 'Open for Q4 Architecture Projects' },
      seo: { twitterHandle: '@mahimdev_verified' },
    },
  });
  assert.equal(partialBannerUpdate.status, 200);

  const afterSettings = await SiteSettings.findOne();
  assert.equal(afterSettings?.banner?.availabilityText, 'Open for Q4 Architecture Projects');
  assert.equal(afterSettings?.banner?.headlineLine2, originalHeadline2);
  assert.equal(afterSettings?.seo?.twitterHandle, '@mahimdev_verified');
});

test('6. Contact Inquiries, Live Unread Counts & Analytics Tracking', async () => {
  // Honeypot bot spam blocked with 422
  const spamAttempt = await apiRequest('/api/v1/messages', {
    method: 'POST',
    body: {
      fullName: 'Bot Spammer',
      email: 'bot@spam.example',
      subject: 'Spam Offer',
      message: 'Automated bot payload filling hidden honeypot.',
      honeypot: 'http://spam.example',
    },
  });
  assert.equal(spamAttempt.status, 422);

  // Valid inquiry creation
  const msgCreate = await apiRequest('/api/v1/messages', {
    method: 'POST',
    body: {
      fullName: 'Elena Rostova',
      email: 'elena@fintech.io',
      service: 'SaaS Applications',
      subject: 'Enterprise SaaS Rebuild',
      message: 'Looking to partner on our multi-tenant SaaS dashboard.',
    },
  });
  assert.equal(msgCreate.status, 201);
  const msgId = msgCreate.body.data.id;
  assert.ok(await Message.findById(msgId));

  // Admin search & filter with malformed page param fallback
  const listRes = await apiRequest('/api/v1/messages?status=New&search=Elena&page=abc', {
    token: superAdminToken,
  });
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.meta.page, 1);
  assert.ok(listRes.body.data.some((m: any) => m._id === msgId));

  // Admin reply & live count return
  const replyRes = await apiRequest(`/api/v1/messages/${msgId}`, {
    method: 'PUT',
    token: superAdminToken,
    body: {
      replyBody: 'Hi Elena, thank you for reaching out! Let us schedule a call.',
      sendEmailReply: false,
    },
  });
  assert.equal(replyRes.status, 200);
  assert.equal(replyRes.body.data.status, 'Replied');
  assert.equal(typeof replyRes.body.meta.counts.unread, 'number');

  const delMsg = await apiRequest(`/api/v1/messages/${msgId}`, {
    method: 'DELETE',
    token: superAdminToken,
  });
  assert.equal(delMsg.status, 200);
  assert.equal(await Message.findById(msgId), null);

  // Analytics tracking & overview
  const trackRes = await apiRequest('/api/v1/analytics/track', {
    method: 'POST',
    body: { path: '/projects', referrer: 'github.com', deviceType: 'desktop' },
  });
  assert.equal(trackRes.status, 201);
  assert.ok((await Analytics.countDocuments({ path: '/projects' })) >= 1);

  const overview = await apiRequest('/api/v1/analytics/overview?days=invalid', {
    token: superAdminToken,
  });
  assert.equal(overview.status, 200);
  assert.equal(overview.body.data.days, 14);

  const visitors = await apiRequest('/api/v1/analytics/visitors?days=7', {
    token: superAdminToken,
  });
  assert.equal(visitors.status, 200);

  const pages = await apiRequest('/api/v1/analytics/pages?days=7', {
    token: superAdminToken,
  });
  assert.equal(pages.status, 200);
});

test('7. Media Upload Magic-Byte Verification, XSS URL Blocking & CORS Hardening', async () => {
  // 1) Spoofed HTML disguised as image/png MUST be rejected (400 INVALID_FILE_SIGNATURE)
  const spoofedForm = new FormData();
  const htmlBytes = new Blob(['<html><script>alert(1)</script></html>'], { type: 'image/png' });
  spoofedForm.append('file', htmlBytes, 'malicious.png');

  const spoofRes = await apiRequest('/api/v1/upload', {
    method: 'POST',
    token: superAdminToken,
    body: spoofedForm,
  });
  assert.equal(spoofRes.status, 400);
  assert.equal(spoofRes.body.error.code, 'INVALID_FILE_SIGNATURE');

  // 2) Authentic 1x1 PNG binary upload succeeds and persists in MediaAsset + /uploads
  const validPngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const pngBuffer = Buffer.from(validPngBase64, 'base64');
  const validForm = new FormData();
  validForm.append('file', new Blob([pngBuffer], { type: 'image/png' }), 'pixel.png');

  const uploadRes = await apiRequest('/api/v1/upload', {
    method: 'POST',
    token: superAdminToken,
    body: validForm,
  });
  assert.equal(uploadRes.status, 201);
  const assetId = uploadRes.body.data._id;
  const assetFilename = uploadRes.body.data.filename;
  const assetUrl = uploadRes.body.data.url;
  assert.ok(await MediaAsset.findById(assetId));

  // Verify served /uploads asset includes nosniff & sandbox CSP headers
  const servedUpload = await fetch(`${baseUrl}${assetUrl}`);
  assert.equal(servedUpload.status, 200);
  assert.equal(servedUpload.headers.get('x-content-type-options'), 'nosniff');
  assert.match(servedUpload.headers.get('content-security-policy') || '', /sandbox/);

  // Delete media asset & confirm DB record + local file are cleaned up
  const delAsset = await apiRequest(`/api/v1/upload/${assetId}`, {
    method: 'DELETE',
    token: superAdminToken,
  });
  assert.equal(delAsset.status, 200);
  assert.equal(await MediaAsset.findById(assetId), null);
  assert.equal(fs.existsSync(path.join(UPLOADS_DIR, assetFilename)), false);

  // 3) Stored XSS javascript: URL rejected with 422
  const xssProject = await apiRequest('/api/v1/projects', {
    method: 'POST',
    token: superAdminToken,
    body: {
      title: 'XSS Link Attempt',
      category: 'SaaS',
      shortDescription: 'Testing stored XSS link validation on project URLs.',
      thumbnail: '/uploads/test.jpg',
      liveUrl: 'javascript:alert(1)',
    },
  });
  assert.equal(xssProject.status, 422);

  // 4) Untrusted cross-origin CORS blocked, trusted localhost origin allowed
  const untrustedCors = await apiRequest('/api/v1/health', {
    headers: { Origin: 'https://evil-attacker.example' },
  });
  assert.equal(untrustedCors.headers.get('access-control-allow-origin'), null);

  const trustedCors = await apiRequest('/api/v1/health', {
    headers: { Origin: 'http://localhost:3000' },
  });
  assert.equal(trustedCors.headers.get('access-control-allow-origin'), 'http://localhost:3000');

  // 5) Invalid ObjectId -> 400, Non-existent ObjectId -> 404, Unknown API endpoint -> 404
  const castErr = await apiRequest('/api/v1/projects/invalid-oid', {
    method: 'DELETE',
    token: superAdminToken,
  });
  assert.equal(castErr.status, 400);

  const missingObj = await apiRequest('/api/v1/projects/507f1f77bcf86cd799439011', {
    method: 'DELETE',
    token: superAdminToken,
  });
  assert.equal(missingObj.status, 404);

  const unknownEndpoint = await apiRequest('/api/v1/non-existent-endpoint');
  assert.equal(unknownEndpoint.status, 404);
});
