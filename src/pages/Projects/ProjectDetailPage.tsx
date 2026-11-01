import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  Github,
  CheckCircle2,
  Eye,
  AlertCircle,
  Lightbulb,
  TrendingUp,
} from 'lucide-react';
import { apiClient, extractApiErrorMessage } from '../../services/api';
import type { ProjectItem } from '../../types/portfolio';
import { ResilientImage } from '../../components/common/ResilientImage';
import { ContactCtaBanner } from '../../components/common/ContactCtaBanner';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectItem | null>(null);
  const [activeImage, setActiveImage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadDetail() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get(`/projects/${id}`);
        if (!mounted) return;
        const data: ProjectItem = res.data.data;
        setProject(data);
        setActiveImage(data.thumbnail);
      } catch (err) {
        if (mounted) {
          setError(extractApiErrorMessage(err, 'Project case study not found.'));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadDetail();
    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-6">
        <div className="h-10 w-64 rounded-xl bg-[#090E2C] animate-pulse" />
        <div className="aspect-[16/9] rounded-3xl bg-[#090E2C] animate-pulse" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="font-display font-bold text-3xl text-white">
          Project Not Found
        </h1>
        <p className="text-sm text-[#B5BCD9]">{error}</p>
        <Link
          to="/projects"
          className="btn-neon-primary inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Projects</span>
        </Link>
      </div>
    );
  }

  const gallery = Array.from(
    new Set([project.thumbnail, ...(project.screenshots || [])].filter(Boolean))
  );

  return (
    <div className="space-y-14 pt-8 pb-8">
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Top Breadcrumb & Meta */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            to="/projects"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#B5BCD9] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Projects</span>
          </Link>

          <div className="flex items-center gap-3 text-xs text-[#B5BCD9]">
            <span className="text-[#00D9FF] font-semibold">{project.category}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Eye className="w-3.5 h-3.5 text-[#A855F7]" />
              {project.views} views
            </span>
          </div>
        </div>

        {/* Title & Actions */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <h1 className="font-display font-extrabold text-3xl sm:text-5xl text-white">
              {project.title}
            </h1>
            <p className="text-base sm:text-lg text-[#B5BCD9] leading-relaxed">
              {project.shortDescription}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {project.liveUrl && (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-neon-primary inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white whitespace-nowrap shrink-0"
              >
                <span>Live Demo</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            {project.githubUrl && (
              <a
                href={project.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-neon-secondary inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-[#F5F5FF] whitespace-nowrap shrink-0"
              >
                <Github className="w-4 h-4" />
                <span>Source Code</span>
              </a>
            )}
          </div>
        </div>

        {/* Main Showcase Screenshot + Gallery Thumbnails */}
        <div className="space-y-4">
          <div className="cosmic-card rounded-3xl overflow-hidden p-2 sm:p-3 border border-[#8B19FF]/35">
            <div className="aspect-[16/9] rounded-2xl overflow-hidden bg-[#05081D]">
              <ResilientImage
                src={activeImage || project.thumbnail}
                alt={project.title}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {gallery.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-2">
              {gallery.map((imgUrl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImage(imgUrl)}
                  aria-label={`View screenshot ${idx + 1}`}
                  className={`w-28 aspect-[16/10] rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                    activeImage === imgUrl
                      ? 'border-[#00D9FF] scale-[1.02]'
                      : 'border-white/10 opacity-70 hover:opacity-100'
                  }`}
                >
                  <ResilientImage
                    src={imgUrl}
                    alt={`${project.title} view ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Overview, Tech Stack & Key Features */}
        <div className="grid lg:grid-cols-12 gap-8 pt-4">
          <div className="lg:col-span-8 space-y-8">
            <div className="cosmic-card rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="font-display font-bold text-2xl text-white">
                Project Overview
              </h2>
              <p className="text-sm sm:text-base text-[#B5BCD9] leading-relaxed">
                {project.overview || project.shortDescription}
              </p>
            </div>

            {/* Challenges, Solutions, Results */}
            <div className="grid sm:grid-cols-2 gap-6">
              {project.challenges && (
                <div className="cosmic-card rounded-2xl p-6 space-y-3">
                  <div className="flex items-center gap-2 text-amber-400 font-display font-bold text-base">
                    <AlertCircle className="w-5 h-5" />
                    <h3>The Challenge</h3>
                  </div>
                  <p className="text-sm text-[#B5BCD9] leading-relaxed">
                    {project.challenges}
                  </p>
                </div>
              )}

              {project.solutions && (
                <div className="cosmic-card rounded-2xl p-6 space-y-3">
                  <div className="flex items-center gap-2 text-[#00D9FF] font-display font-bold text-base">
                    <Lightbulb className="w-5 h-5" />
                    <h3>Architectural Solution</h3>
                  </div>
                  <p className="text-sm text-[#B5BCD9] leading-relaxed">
                    {project.solutions}
                  </p>
                </div>
              )}
            </div>

            {project.results && (
              <div className="cosmic-card rounded-2xl p-6 space-y-3 border-[#00E69A]/30">
                <div className="flex items-center gap-2 text-[#00E69A] font-display font-bold text-base">
                  <TrendingUp className="w-5 h-5" />
                  <h3>Key Outcomes &amp; Results</h3>
                </div>
                <p className="text-sm sm:text-base text-[#E2E8F0] leading-relaxed">
                  {project.results}
                </p>
              </div>
            )}
          </div>

          {/* Right Sidebar: Technologies & Features */}
          <div className="lg:col-span-4 space-y-6">
            <div className="cosmic-card rounded-2xl p-6 space-y-4">
              <h3 className="font-display font-bold text-lg text-white">
                Technologies Used
              </h3>
              <div className="text-sm text-[#00D9FF] leading-relaxed">
                {project.technologies.length > 0
                  ? project.technologies.join(' · ')
                  : 'TypeScript · React · Node.js · MongoDB'}
              </div>
            </div>

            {project.features.length > 0 && (
              <div className="cosmic-card rounded-2xl p-6 space-y-4">
                <h3 className="font-display font-bold text-lg text-white">
                  Core Features
                </h3>
                <ul className="space-y-3">
                  {project.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-[#E2E8F0]">
                      <CheckCircle2 className="w-4 h-4 text-[#00E69A] shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      <ContactCtaBanner showQuickForm={false} />
    </div>
  );
};
