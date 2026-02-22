'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowDownRight,
  ArrowUpRight,
  Gauge,
  Landmark,
  Plus,
  Target,
  Trophy,
  XCircle,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { PipelineBoard } from '@/components/financial/PipelineBoard';
import { DealDialog } from '@/components/financial/DealDialog';
import CountUpNumber from '@/components/financial/CountUpNumber';

function PremiumCounter({ value, prefix = '', suffix = '' }) {
  return (
    <span className="inline-flex items-baseline gap-0.5">
      {prefix ? <span>{prefix}</span> : null}
      <CountUpNumber value={Math.round(Number(value) || 0)} duration={0.9} />
      {suffix ? <span>{suffix}</span> : null}
    </span>
  );
}

function TrendPill({ value = 0 }) {
  const isPositive = value >= 0;
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${
        isPositive
          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
          : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
      }`}
    >
      <Icon size={14} />
      <span>{Math.abs(value)}%</span>
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, trend, caption, prefix = '', suffix = '', tone = 'blue' }) {
  const styles = {
    blue: 'from-sky-500/14 to-cyan-400/6 border-sky-200/60 dark:from-sky-500/20 dark:to-cyan-400/8 dark:border-sky-700/40',
    amber: 'from-amber-500/14 to-orange-400/6 border-amber-200/60 dark:from-amber-500/20 dark:to-orange-400/8 dark:border-amber-700/40',
    emerald: 'from-emerald-500/14 to-teal-400/6 border-emerald-200/60 dark:from-emerald-500/20 dark:to-teal-400/8 dark:border-emerald-700/40',
    rose: 'from-rose-500/14 to-red-400/6 border-rose-200/60 dark:from-rose-500/20 dark:to-red-400/8 dark:border-rose-700/40',
    slate: 'from-slate-500/14 to-zinc-400/6 border-slate-200/60 dark:from-slate-500/20 dark:to-zinc-400/8 dark:border-slate-700/40',
  };

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 shadow-[0_10px_32px_-22px_rgba(15,23,42,.65)] ${styles[tone]}`}
    >
      <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/30 blur-2xl dark:bg-slate-800/40" />
      </div>

      <div className="relative z-10 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{title}</p>
          <div className="mt-3 text-3xl font-bold leading-none text-slate-900 dark:text-slate-100">
            <PremiumCounter value={value} prefix={prefix} suffix={suffix} />
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{caption}</p>
        </div>

        <div className="rounded-xl bg-white/75 p-2.5 text-slate-700 shadow-sm backdrop-blur dark:bg-slate-900/70 dark:text-slate-300">
          <Icon size={20} strokeWidth={1.9} />
        </div>
      </div>

      <div className="relative z-10 mt-4">
        <TrendPill value={trend} />
      </div>
    </motion.div>
  );
}

export default function PipelinePage() {
  const [deals, setDeals] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const fetchData = async () => {
    try {
      setPageLoading(true);
      const [dealsRes, valuationRes] = await Promise.all([
        fetchWithAuth('/api/deals', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          },
        }),
        fetchWithAuth('/api/deals/valuation', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          },
        }),
      ]);

      if (dealsRes.ok && valuationRes.ok) {
        const dealsData = await dealsRes.json();
        const valuationData = await valuationRes.json();

        const fetchedDeals = dealsData.data || [];
        setDeals(
          fetchedDeals.map((deal) => ({
            ...deal,
            value_estimate: Number(deal.value_estimate) || 0,
            probability: Number(deal.probability) || 0,
          }))
        );

        return valuationData;
      }
      return null;
    } catch (error) {
      console.error('Error fetching data:', error);
      return null;
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const stats = useMemo(() => {
    const totalPipelineValue = deals.reduce((sum, d) => sum + Number(d.value_estimate || 0), 0);
    const weightedPipelineValue = deals.reduce(
      (sum, d) => sum + Number(d.value_estimate || 0) * (Number(d.probability || 0) / 100),
      0
    );
    const wonDeals = deals.filter((d) => d.stage === 'Won');
    const lostDeals = deals.filter((d) => d.stage === 'Lost');
    const openDeals = deals.filter((d) => d.stage !== 'Won' && d.stage !== 'Lost');
    const wonTotal = wonDeals.reduce((sum, d) => sum + Number(d.value_estimate || 0), 0);
    const lostTotal = lostDeals.reduce((sum, d) => sum + Number(d.value_estimate || 0), 0);
    const conversionRate = deals.length ? Math.round((wonDeals.length / deals.length) * 100) : 0;

    return {
      totalPipelineValue,
      weightedPipelineValue,
      wonTotal,
      lostTotal,
      openDeals: openDeals.length,
      conversionRate,
    };
  }, [deals]);

  const summaryCards = [
    {
      title: 'Total Pipeline Value',
      value: stats.totalPipelineValue,
      prefix: 'UGX ',
      suffix: '',
      icon: Landmark,
      tone: 'blue',
      trend: 14,
      caption: 'Gross value across all active opportunities',
    },
    {
      title: 'Weighted Value',
      value: stats.weightedPipelineValue,
      prefix: 'UGX ',
      suffix: '',
      icon: Gauge,
      tone: 'amber',
      trend: 9,
      caption: 'Probability-adjusted value for forecasting',
    },
    {
      title: 'Deals Won',
      value: stats.wonTotal,
      prefix: 'UGX ',
      suffix: '',
      icon: Trophy,
      tone: 'emerald',
      trend: 11,
      caption: 'Closed-won value this cycle',
    },
    {
      title: 'Deals Lost',
      value: stats.lostTotal,
      prefix: 'UGX ',
      suffix: '',
      icon: XCircle,
      tone: 'rose',
      trend: -4,
      caption: 'Value leakage requiring review',
    },
    {
      title: 'Lead Conversion Rate',
      value: stats.conversionRate,
      suffix: '%',
      icon: Target,
      tone: 'slate',
      trend: 6,
      caption: `${stats.openDeals} active deals currently in motion`,
    },
  ];

  const handleEditDeal = (deal) => {
    setSelectedDeal(deal);
    setIsDialogOpen(true);
  };

  const handleDeleteDeal = async (id) => {
    if (!confirm('Are you sure you want to delete this deal?')) return;

    try {
      const response = await fetch(`/api/deals/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      if (response.ok) {
        setDeals((prev) => prev.filter((deal) => deal.id !== id));
      }
    } catch (error) {
      console.error('Error deleting deal:', error);
    }
  };

  const handleSaveDeal = async (formData) => {
    setIsLoading(true);
    try {
      const url = selectedDeal ? `/api/deals/${selectedDeal.id}` : '/api/deals';
      const method = selectedDeal ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await fetchData();
        setIsDialogOpen(false);
        setSelectedDeal(null);
      }
    } catch (error) {
      console.error('Error saving deal:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStageChange = async (dealId, newStage) => {
    setDeals((prev) => prev.map((deal) => (deal.id === dealId ? { ...deal, stage: newStage } : deal)));
  };

  const handleSetStage = async (deal, stage) => {
    try {
      const response = await fetch(`/api/deals/${deal.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          ...deal,
          stage,
        }),
      });

      if (response.ok) {
        handleStageChange(deal.id, stage);
      }
    } catch (error) {
      console.error('Error updating stage:', error);
    }
  };

  if (pageLoading) {
    return (
      <div className="flex h-[420px] items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
          className="h-12 w-12 rounded-full border-4 border-slate-300 border-t-slate-900 dark:border-slate-700 dark:border-t-white"
        />
      </div>
    );
  }

  return (
    <div className="space-y-7 pb-10">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-gradient-to-br from-white via-slate-50 to-sky-50/70 p-7 shadow-[0_24px_80px_-52px_rgba(15,23,42,.55)] dark:border-slate-800/70 dark:from-slate-950 dark:via-slate-900 dark:to-sky-950/30">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-sky-300/30 blur-3xl dark:bg-sky-600/20" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Revenue Command Center</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 md:text-5xl">Pipeline Intelligence</h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-600 dark:text-slate-300 md:text-base">
              Executive-grade visibility into deal momentum, stage risk, and forecast precision. Built for fast decisions under real pressure.
            </p>
          </div>

          <Link
            href="/app/deals/create"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-black dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            <Plus size={18} />
            Add Deal
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <SummaryCard {...card} />
          </motion.div>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200/70 bg-white/70 p-5 backdrop-blur-sm dark:border-slate-800/70 dark:bg-slate-950/60 md:p-7">
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Pipeline Stages</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Featured opportunities surface first. Drag and drop deals to keep forecasts current.</p>
          </div>
        </div>

        <PipelineBoard
          deals={deals}
          onStageChange={handleStageChange}
          onEdit={handleEditDeal}
          onDelete={handleDeleteDeal}
          onSetStage={handleSetStage}
        />
      </section>

      <DealDialog
        isOpen={isDialogOpen}
        deal={selectedDeal}
        onClose={() => {
          setIsDialogOpen(false);
          setSelectedDeal(null);
        }}
        onSave={handleSaveDeal}
        isLoading={isLoading}
      />
    </div>
  );
}
