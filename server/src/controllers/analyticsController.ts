import { Request, Response, NextFunction } from 'express';
import {
  Analytics,
  Project,
  Message,
  Testimonial,
  Service,
  MediaAsset,
} from '../models';
import { AuthenticatedRequest } from '../middleware/auth';
import { analyticsTrackSchema } from '../validations/schemas';
import { createPrivacyVisitorHash, parsePositiveInt } from '../utils/sanitize';
import { getDatabaseHealth } from '../config/database';
import { env, isCloudinaryConfigured, isSmtpConfigured } from '../config/env';

export async function trackPageVisit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = analyticsTrackSchema.parse(req.body);
    const dateBucket = new Date().toISOString().slice(0, 10);
    const visitorHash = createPrivacyVisitorHash(
      req.ip || '0.0.0.0',
      String(req.headers['user-agent'] || ''),
      dateBucket
    );

    await Analytics.create({
      path: parsed.path,
      visitorHash,
      referrer: parsed.referrer || 'Direct',
      projectSlug: parsed.projectSlug,
      deviceType: parsed.deviceType,
      dateBucket,
    });

    res.status(201).json({ success: true, data: { recorded: true } });
  } catch (err) {
    next(err);
  }
}

export async function getAnalyticsOverview(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const days = parsePositiveInt(req.query.days, 14, 90);
    const sinceDate = new Date(Date.now() - (days - 1) * 86400000);
    const sinceBucket = sinceDate.toISOString().slice(0, 10);

    const [
      totalProjects,
      publishedProjects,
      totalServices,
      totalMessages,
      unreadMessages,
      totalPageViews,
      uniqueVisitorHashes,
      testimonials,
      recentMessages,
      topProjects,
      dailyBuckets,
      mediaCount,
    ] = await Promise.all([
      Project.countDocuments(),
      Project.countDocuments({ published: true }),
      Service.countDocuments({ published: true }),
      Message.countDocuments(),
      Message.countDocuments({ status: 'New' }),
      Analytics.countDocuments({ dateBucket: { $gte: sinceBucket } }),
      Analytics.distinct('visitorHash', { dateBucket: { $gte: sinceBucket } }),
      Testimonial.find({ published: true }).select('rating'),
      Message.find().sort({ createdAt: -1 }).limit(5),
      Project.find().sort({ views: -1, featured: -1, order: 1 }).limit(5),
      Analytics.aggregate([
        { $match: { dateBucket: { $gte: sinceBucket } } },
        {
          $group: {
            _id: '$dateBucket',
            pageViews: { $sum: 1 },
            visitorsSet: { $addToSet: '$visitorHash' },
          },
        },
        {
          $project: {
            _id: 0,
            date: '$_id',
            pageViews: 1,
            visitors: { $size: '$visitorsSet' },
          },
        },
        { $sort: { date: 1 } },
      ]),
      MediaAsset.countDocuments(),
    ]);

    const avgRating =
      testimonials.length > 0
        ? (
            testimonials.reduce((acc, item) => acc + (item.rating || 5), 0) /
            testimonials.length
          ).toFixed(1)
        : '5.0';

    // Build continuous daily timeline for selected date range
    const bucketMap = new Map<string, { pageViews: number; visitors: number }>();
    for (const row of dailyBuckets) {
      bucketMap.set(row.date, {
        pageViews: row.pageViews,
        visitors: row.visitors,
      });
    }

    // Count daily messages in the same range
    const messageBuckets = await Message.aggregate([
      { $match: { createdAt: { $gte: sinceDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          inquiries: { $sum: 1 },
        },
      },
    ]);
    const msgMap = new Map<string, number>();
    for (const m of messageBuckets) {
      msgMap.set(m._id, m.inquiries);
    }

    const chartSeries: Array<{
      date: string;
      label: string;
      pageViews: number;
      visitors: number;
      inquiries: number;
    }> = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const entry = bucketMap.get(iso) || { pageViews: 0, visitors: 0 };
      chartSeries.push({
        date: iso,
        label,
        pageViews: entry.pageViews,
        visitors: entry.visitors,
        inquiries: msgMap.get(iso) || 0,
      });
    }

    const dbHealth = getDatabaseHealth();

    res.status(200).json({
      success: true,
      data: {
        cards: {
          totalProjects,
          publishedProjects,
          totalServices,
          totalMessages,
          unreadMessages,
          totalVisitors: uniqueVisitorHashes.length,
          totalPageViews,
          clientRating: Number(avgRating),
        },
        days,
        chartSeries,
        recentMessages,
        topProjects,
        systemStatus: {
          environment: env.NODE_ENV,
          apiVersion: 'v1',
          uptimeSeconds: Math.floor(process.uptime()),
          database: dbHealth,
          storage: {
            provider: isCloudinaryConfigured() ? 'Cloudinary Cloud' : 'Local Disk (/uploads)',
            cloudinaryConfigured: isCloudinaryConfigured(),
            storedAssetsCount: mediaCount,
          },
          email: {
            smtpConfigured: isSmtpConfigured(),
            statusLabel: isSmtpConfigured()
              ? 'SMTP Ready'
              : 'Inbox DB Only (Set EMAIL_SERVICE_* for outbound email)',
          },
          security: {
            jwtAuth: true,
            rateLimiting: true,
            helmetHeaders: true,
          },
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getVisitorsAnalytics(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const days = parsePositiveInt(req.query.days, 30, 90);
    const sinceBucket = new Date(Date.now() - (days - 1) * 86400000)
      .toISOString()
      .slice(0, 10);

    const [byDevice, byDate] = await Promise.all([
      Analytics.aggregate([
        { $match: { dateBucket: { $gte: sinceBucket } } },
        { $group: { _id: '$deviceType', count: { $sum: 1 } } },
        { $project: { _id: 0, device: '$_id', count: 1 } },
      ]),
      Analytics.aggregate([
        { $match: { dateBucket: { $gte: sinceBucket } } },
        {
          $group: {
            _id: '$dateBucket',
            pageViews: { $sum: 1 },
            visitors: { $addToSet: '$visitorHash' },
          },
        },
        {
          $project: {
            _id: 0,
            date: '$_id',
            pageViews: 1,
            uniqueVisitors: { $size: '$visitors' },
          },
        },
        { $sort: { date: 1 } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        days,
        byDevice,
        byDate,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getPagesAnalytics(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const days = parsePositiveInt(req.query.days, 30, 90);
    const sinceBucket = new Date(Date.now() - (days - 1) * 86400000)
      .toISOString()
      .slice(0, 10);

    const [popularPages, referrers, projectViews] = await Promise.all([
      Analytics.aggregate([
        { $match: { dateBucket: { $gte: sinceBucket } } },
        { $group: { _id: '$path', views: { $sum: 1 } } },
        { $project: { _id: 0, path: '$_id', views: 1 } },
        { $sort: { views: -1 } },
        { $limit: 12 },
      ]),
      Analytics.aggregate([
        { $match: { dateBucket: { $gte: sinceBucket } } },
        { $group: { _id: '$referrer', visits: { $sum: 1 } } },
        { $project: { _id: 0, source: '$_id', visits: 1 } },
        { $sort: { visits: -1 } },
        { $limit: 10 },
      ]),
      Project.find().select('title slug category views featured published').sort({ views: -1 }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        days,
        popularPages,
        referrers,
        projectViews,
      },
    });
  } catch (err) {
    next(err);
  }
}
