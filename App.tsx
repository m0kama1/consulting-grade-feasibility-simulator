
import React, { useState, useEffect } from 'react';
import { ModuleType, SimulationState, ProjectDecision, MarketEvent } from './types';
import { PROJECT_TYPES, INITIAL_KPI_STATE } from './constants';
import { geminiService } from './services/geminiService';
import { 
  Activity, 
  BarChart3, 
  ChevronLeft, 
  Cpu, 
  DollarSign, 
  FileText, 
  PieChart, 
  ShieldAlert, 
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Briefcase,
  Target,
  ArrowRightLeft
} from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<SimulationState>({
    currentModule: ModuleType.INIT,
    projectType: '',
    projectName: '',
    budget: 0,
    spent: 0,
    decisions: {},
    kpis: INITIAL_KPI_STATE,
    events: [],
    history: []
  });

  const [projectContext, setProjectContext] = useState<any>(null);
  const [decisions, setDecisions] = useState<ProjectDecision[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [finalReport, setFinalReport] = useState<string>('');
  const [activeEvent, setActiveEvent] = useState<MarketEvent | null>(null);

  const startProject = async (typeId: string) => {
    setIsLoading(true);
    try {
      const context = await geminiService.generateProjectContext(typeId);
      setProjectContext(context);
      setState(prev => ({
        ...prev,
        projectType: typeId,
        projectName: context.projectName,
        budget: context.initialBudget,
        currentModule: ModuleType.TECHNICAL,
        kpis: { ...prev.kpis, progress: 10 }
      }));
      const initialDecisions = await geminiService.generateModuleDecisions(ModuleType.TECHNICAL, context);
      setDecisions(initialDecisions);
    } catch (error) {
      console.error("Project Start Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecision = (decisionId: string, optionId: string) => {
    const decision = decisions.find(d => d.id === decisionId);
    const option = decision?.options.find(o => o.id === optionId);
    if (!option) return;

    setState(prev => {
      const newSpent = prev.spent + option.impacts.capex;
      const riskDelta = option.impacts.risk;
      const marketDelta = option.impacts.marketShare;
      const investorDelta = option.impacts.investorConfidence || 0;
      
      return {
        ...prev,
        spent: newSpent,
        decisions: { ...prev.decisions, [decisionId]: optionId },
        kpis: {
          ...prev.kpis,
          riskIndex: Math.min(100, Math.max(0, prev.kpis.riskIndex + riskDelta)),
          marketConfidence: Math.min(100, Math.max(0, prev.kpis.marketConfidence + marketDelta)),
          investorConfidence: Math.min(100, Math.max(0, prev.kpis.investorConfidence + investorDelta)),
          progress: Math.min(95, prev.kpis.progress + 2)
        }
      };
    });
  };

  const triggerRandomEvent = async () => {
    try {
      const event = await geminiService.generateRandomEvent(state);
      setActiveEvent(event);
      setState(prev => ({
        ...prev,
        events: [...prev.events, event],
        kpis: {
          ...prev.kpis,
          riskIndex: Math.min(100, Math.max(0, prev.kpis.riskIndex + (event.kpiImpacts.riskIndex || 0))),
          marketConfidence: Math.min(100, Math.max(0, prev.kpis.marketConfidence + (event.kpiImpacts.marketConfidence || 0))),
          investorConfidence: Math.min(100, Math.max(0, prev.kpis.investorConfidence - (event.impactType === 'NEGATIVE' ? 5 : 0)))
        },
        spent: prev.spent + (event.kpiImpacts.budgetImpact || 0)
      }));
    } catch (e) {
      console.error("Event Generation Error", e);
    }
  };

  const nextModule = async () => {
    const modulesOrder = [ModuleType.TECHNICAL, ModuleType.MARKETING, ModuleType.FINANCIAL, ModuleType.FINAL_REPORT];
    const currentIndex = modulesOrder.indexOf(state.currentModule);
    const nextMod = modulesOrder[currentIndex + 1];

    if (!nextMod) return;

    setIsLoading(true);
    await triggerRandomEvent();

    try {
      if (nextMod === ModuleType.FINAL_REPORT) {
        const finalKpis = calculateDetailedFinancials(state);
        const report = await geminiService.evaluateFinalReport({ ...state, kpis: finalKpis });
        setFinalReport(report);
        setState(prev => ({ ...prev, currentModule: nextMod, kpis: finalKpis }));
      } else {
        const nextDecisions = await geminiService.generateModuleDecisions(nextMod, projectContext);
        setDecisions(nextDecisions);
        setState(prev => ({ ...prev, currentModule: nextMod }));
      }
    } catch (error) {
      console.error("Module Transition Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateDetailedFinancials = (currentState: SimulationState) => {
    const capex = currentState.spent;
    const confidence = currentState.kpis.marketConfidence;
    const risk = currentState.kpis.riskIndex;
    const investor = currentState.kpis.investorConfidence;
    
    const baseRevenueFactor = currentState.projectType === 'CHIP_FAB' ? 0.45 : 0.35;
    const annualRevenue = (capex * baseRevenueFactor) * (confidence / 50) * (investor / 70);
    const annualOpex = (capex * 0.08) * (1 + (risk / 100));
    const annualCashFlow = annualRevenue - annualOpex;
    
    const discountRate = 0.10 + (risk / 400);
    let npv = -capex;
    for(let i=1; i<=10; i++) {
        npv += annualCashFlow / Math.pow(1 + discountRate, i);
    }
    
    const irr = (annualCashFlow / capex) * 100 * 0.9;
    const viabilityScore = Math.min(100, Math.max(0, 
      (npv > 0 ? 40 : 10) + (irr > 15 ? 30 : 15) + (investor / 2) - (risk / 4)
    ));

    return {
      ...currentState.kpis,
      npv: Math.round(npv),
      irr: Math.round(irr * 10) / 10,
      viabilityScore: Math.round(viabilityScore),
      progress: 100
    };
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(val);
  };

  const formatPercent = (val: number) => {
    return (Math.round(val * 10) / 10).toFixed(1);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-900 overflow-x-hidden selection:bg-indigo-100 selection:text-indigo-900">
      {/* Premium Header */}
      <header className="glass sticky top-0 z-50 border-b border-slate-200/60 px-6 lg:px-12 py-5 flex items-center justify-between shadow-sm backdrop-saturate-150">
        <div className="flex items-center gap-5">
          <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg shadow-indigo-600/20 transform hover:rotate-6 transition-transform">
            <Activity size={28} />
          </div>
          <div>
            <h1 className="font-black text-slate-900 text-2xl tracking-tight">مركز الجدوى الاستراتيجي</h1>
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.1em] mt-0.5 opacity-80">محاكاة قرارات الاستثمار الكبرى</p>
          </div>
        </div>

        {state.currentModule !== ModuleType.INIT && (
          <div className="flex items-center gap-12">
            <div className="hidden lg:flex flex-col items-start border-r border-slate-200 pr-10">
              <span className="text-[10px] text-slate-400 font-black uppercase mb-1 tracking-wider">الإنفاق الرأسمالي (CAPEX)</span>
              <span className={`font-mono text-xl font-black tabular-nums ${state.spent > state.budget ? 'text-rose-600' : 'text-slate-900'}`}>
                {formatCurrency(state.spent)} <span className="text-slate-300 text-sm font-medium">/ {formatCurrency(state.budget)}</span>
              </span>
            </div>
            
            <div className="flex items-center gap-8">
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-slate-400 font-black uppercase mb-1.5 tracking-wider">مؤشر الإنجاز</span>
                <div className="w-32 h-2.5 bg-slate-200/50 rounded-full overflow-hidden border border-slate-200/50 p-0.5 shadow-inner">
                  <div 
                    className="h-full bg-indigo-600 rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(79,70,229,0.4)]"
                    style={{ width: `${state.kpis.progress}%` }}
                  ></div>
                </div>
              </div>
              <div className="flex flex-col items-center bg-indigo-50 px-4 py-1.5 rounded-xl border border-indigo-100">
                <span className="text-[10px] text-indigo-400 font-black uppercase mb-0.5">المرحلة</span>
                <span className="font-black text-indigo-600 text-lg leading-none">{Math.round(state.kpis.progress)}%</span>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 max-w-[1600px]">
        {state.currentModule === ModuleType.INIT && (
          <div className="max-w-5xl mx-auto space-y-16 py-10 animate-in fade-in slide-in-from-bottom-12 duration-1000">
            <div className="text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 mb-2">
                <Briefcase size={16} />
                <span className="text-sm font-black uppercase tracking-widest">مستشار أول استثمارات</span>
              </div>
              <h2 className="text-6xl font-black text-slate-900 leading-[1.15] tracking-tight">ابدأ دراسة جدوى<br/><span className="text-indigo-600">عالمية المستوى</span></h2>
              <p className="text-slate-500 text-xl max-w-2xl mx-auto font-medium leading-relaxed">
                انخرط في محاكاة احترافية تتطلب توازناً دقيقاً بين الميزانية، المخاطر، والفرص السوقية.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
              {PROJECT_TYPES.map((project) => (
                <button
                  key={project.id}
                  onClick={() => startProject(project.id)}
                  disabled={isLoading}
                  className="group relative p-10 bg-white border border-slate-200 rounded-[2.5rem] text-right hover:border-indigo-500 hover:shadow-[0_20px_60px_-15px_rgba(79,70,229,0.15)] transition-all duration-500 disabled:opacity-50 overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-2.5 h-full bg-slate-100 group-hover:bg-indigo-600 transition-all duration-500"></div>
                  <div className="flex items-start justify-between mb-8">
                    <div className="text-6xl transform group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500">{project.icon}</div>
                    <div className="bg-slate-50 p-4 rounded-2xl group-hover:bg-indigo-50 transition-colors border border-slate-100 group-hover:border-indigo-100">
                      <ChevronLeft className="text-slate-400 group-hover:text-indigo-600" size={28} />
                    </div>
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 mb-4 group-hover:text-indigo-600 transition-colors tracking-tight">{project.name}</h3>
                  <p className="text-slate-500 text-lg leading-relaxed font-medium opacity-80">
                    {project.description}
                  </p>
                </button>
              ))}
            </div>

            {isLoading && (
              <div className="flex flex-col items-center gap-8 py-16 animate-in zoom-in-95 duration-500">
                <div className="relative">
                  <div className="w-20 h-20 border-[6px] border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Activity size={24} className="text-indigo-600 animate-pulse" />
                  </div>
                </div>
                <p className="text-indigo-600 text-2xl font-black animate-pulse tracking-tight">جاري تهيئة البيئة الاستشارية...</p>
              </div>
            )}
          </div>
        )}

        {state.currentModule !== ModuleType.INIT && state.currentModule !== ModuleType.FINAL_REPORT && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Sidebar Performance Cards */}
            <div className="lg:col-span-3 space-y-8">
              <div className="bg-slate-900 text-white rounded-[2.5rem] p-10 shadow-2xl shadow-indigo-900/20 relative overflow-hidden ring-1 ring-white/10">
                <div className="absolute -top-12 -left-12 w-48 h-48 bg-indigo-500/20 rounded-full blur-[80px]"></div>
                <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-indigo-600/10 rounded-full blur-[60px]"></div>
                
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-8 flex items-center gap-3">
                  <Briefcase size={16} className="shrink-0" /> تفاصيل المهمة الحالية
                </h3>
                <h4 className="text-3xl font-black mb-6 leading-[1.2] tracking-tight text-white">{state.projectName}</h4>
                
                <div className="space-y-5 mt-10">
                  {projectContext?.objectives.map((obj: string, i: number) => (
                    <div key={i} className="flex gap-4 text-sm text-slate-300/90 leading-relaxed font-medium group">
                      <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0 group-hover:scale-125 transition-transform shadow-[0_0_12px_rgba(99,102,241,0.8)]"></div>
                      {obj}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200/60 rounded-[2.5rem] p-10 shadow-sm hover:shadow-xl transition-shadow duration-500">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-10 flex items-center gap-3">
                  <Target size={16} /> مؤشرات الأداء الحيوية
                </h3>
                <div className="space-y-8">
                  <div className="flex items-center justify-between group">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-slate-400 font-black uppercase tracking-widest">المخاطر</span>
                      <span className={`text-2xl font-black tabular-nums transition-colors ${state.kpis.riskIndex > 60 ? 'text-rose-600' : 'text-slate-900'}`}>{formatPercent(state.kpis.riskIndex)}%</span>
                    </div>
                    <div className={`p-4 rounded-2xl transition-colors ${state.kpis.riskIndex > 60 ? 'bg-rose-50' : 'bg-slate-50'}`}>
                      <ShieldAlert size={24} className={state.kpis.riskIndex > 60 ? 'text-rose-500' : 'text-slate-300'} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between group">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-slate-400 font-black uppercase tracking-widest">ثقة المستثمرين</span>
                      <span className="text-2xl font-black tabular-nums text-slate-900">{formatPercent(state.kpis.investorConfidence)}%</span>
                    </div>
                    <div className="p-4 rounded-2xl bg-indigo-50">
                      <BarChart3 size={24} className="text-indigo-600" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between group">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-slate-400 font-black uppercase tracking-widest">توقع الحصة السوقية</span>
                      <span className="text-2xl font-black tabular-nums text-slate-900">{formatPercent(state.kpis.marketConfidence)}%</span>
                    </div>
                    <div className="p-4 rounded-2xl bg-emerald-50">
                      <TrendingUp size={24} className="text-emerald-500" />
                    </div>
                  </div>
                </div>
              </div>

              {activeEvent && (
                <div className="bg-amber-50/80 border border-amber-200 rounded-[2.5rem] p-8 animate-in slide-in-from-right-8 duration-700 shadow-xl shadow-amber-900/5 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-2 h-full bg-amber-400/30"></div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="bg-amber-400 p-2 rounded-xl text-amber-900 shadow-lg shadow-amber-400/20 group-hover:animate-pulse">
                      <Zap size={20} className="fill-current" />
                    </div>
                    <h4 className="font-black text-amber-900 text-sm tracking-tight uppercase">خبر عاجل من السوق</h4>
                  </div>
                  <h5 className="font-bold text-amber-800 text-lg mb-3 leading-snug">{activeEvent.title}</h5>
                  <p className="text-sm text-amber-700/90 leading-relaxed font-medium">{activeEvent.description}</p>
                </div>
              )}
            </div>

            {/* Main Decision Workspace */}
            <div className="lg:col-span-9 space-y-10">
              <div className="bg-white border border-slate-200/60 rounded-[3rem] p-10 lg:p-14 shadow-sm relative overflow-hidden ring-1 ring-slate-100">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-14 pb-10 border-b border-slate-100">
                  <div className="flex items-center gap-6">
                    <div className={`p-6 rounded-[2rem] shadow-xl ${
                      state.currentModule === ModuleType.TECHNICAL ? 'bg-indigo-600 text-white shadow-indigo-600/20' : 
                      state.currentModule === ModuleType.MARKETING ? 'bg-emerald-600 text-white shadow-emerald-600/20' : 
                      'bg-amber-600 text-white shadow-amber-600/20'
                    }`}>
                      {state.currentModule === ModuleType.TECHNICAL && <Cpu size={40} />}
                      {state.currentModule === ModuleType.MARKETING && <TrendingUp size={40} />}
                      {state.currentModule === ModuleType.FINANCIAL && <DollarSign size={40} />}
                    </div>
                    <div>
                      <h2 className="text-4xl font-black text-slate-900 tracking-tight">
                        {state.currentModule === ModuleType.TECHNICAL ? 'الجدوى الفنية والتشغيلية' : 
                         state.currentModule === ModuleType.MARKETING ? 'دراسة السوق والمنافسة' : 
                         'النمذجة والتحليل المالي'}
                      </h2>
                      <p className="text-slate-400 font-bold text-lg mt-1 opacity-80">صياغة الاستراتيجية التنفيذية للمشروع</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 px-6 py-3 bg-slate-50 rounded-2xl border border-slate-100">
                     <div className="flex items-center gap-2">
                        <ArrowRightLeft size={18} className="text-slate-400" />
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">توازن المقايضات</span>
                     </div>
                  </div>
                </div>

                {isLoading ? (
                  <div className="py-32 text-center space-y-8 animate-in fade-in duration-500">
                    <div className="flex justify-center relative">
                       <div className="w-16 h-16 border-[6px] border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
                       <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-2 h-2 bg-indigo-600 rounded-full animate-ping"></div>
                       </div>
                    </div>
                    <p className="text-slate-500 font-black text-2xl italic tracking-tight">جاري معالجة المتغيرات وتوليد سيناريوهات القرار...</p>
                  </div>
                ) : (
                  <div className="space-y-16">
                    {decisions.map((decision) => (
                      <div key={decision.id} className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
                        <div className="flex items-start gap-5">
                          <span className="px-4 py-1.5 bg-slate-900 rounded-xl text-[11px] font-black text-white uppercase mt-1 tracking-widest shadow-lg shadow-slate-900/10">
                            {decision.category}
                          </span>
                          <h4 className="text-2xl font-black text-slate-800 leading-[1.3] tracking-tight">{decision.question}</h4>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {decision.options.map((option) => {
                             const isSelected = state.decisions[decision.id] === option.id;
                             return (
                                <button
                                  key={option.id}
                                  onClick={() => handleDecision(decision.id, option.id)}
                                  className={`p-8 rounded-[2rem] border-2 text-right transition-all group relative h-full flex flex-col justify-between ${
                                    isSelected
                                      ? 'bg-indigo-50 border-indigo-600 shadow-[0_20px_40px_-10px_rgba(79,70,229,0.15)] ring-4 ring-indigo-50'
                                      : 'bg-white border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 shadow-sm hover:shadow-md'
                                  }`}
                                >
                                  <div>
                                    <div className="flex justify-between items-start mb-6">
                                      <span className={`font-black text-xl leading-tight transition-colors ${isSelected ? 'text-indigo-700' : 'text-slate-900'}`}>
                                        {option.label}
                                      </span>
                                      {isSelected && (
                                        <div className="bg-indigo-600 p-1.5 rounded-full shadow-lg shadow-indigo-600/30 scale-110">
                                          <CheckCircle2 size={18} className="text-white shrink-0" />
                                        </div>
                                      )}
                                    </div>
                                    <p className="text-[15px] text-slate-500 font-medium leading-relaxed mb-8">{option.description}</p>
                                  </div>
                                  
                                  <div className="pt-6 border-t border-slate-100 flex flex-wrap gap-x-5 gap-y-3">
                                    <div className="flex items-center gap-2">
                                      <DollarSign size={14} className={isSelected ? 'text-indigo-400' : 'text-slate-300'} />
                                      <span className={`text-[11px] font-black uppercase tracking-tighter ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`}>
                                        CAPEX: {option.impacts.capex > 0 ? '+' : ''}{Math.round(option.impacts.capex / 1000)}k
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <ShieldAlert size={14} className={isSelected ? 'text-indigo-400' : 'text-slate-300'} />
                                      <span className={`text-[11px] font-black uppercase tracking-tighter ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`}>
                                        مخاطر: {option.impacts.risk > 0 ? '+' : ''}{option.impacts.risk}%
                                      </span>
                                    </div>
                                  </div>
                                </button>
                             );
                          })}
                        </div>
                      </div>
                    ))}

                    <div className="pt-12 flex justify-end">
                      <button
                        onClick={nextModule}
                        disabled={Object.keys(state.decisions).length < (decisions.length * (
                          state.currentModule === ModuleType.TECHNICAL ? 1 : 
                          state.currentModule === ModuleType.MARKETING ? 2 : 3
                        ))}
                        className="group flex items-center gap-4 bg-slate-900 text-white px-12 py-5 rounded-[2rem] font-black text-xl hover:bg-indigo-600 hover:shadow-[0_20px_50px_-10px_rgba(79,70,229,0.3)] transition-all disabled:opacity-10 disabled:grayscale disabled:cursor-not-allowed"
                      >
                        اعتماد النتائج والمتابعة
                        <ChevronLeft size={24} className="group-hover:-translate-x-2 transition-transform" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {state.currentModule === ModuleType.FINAL_REPORT && (
          <div className="max-w-[1200px] mx-auto space-y-12 py-10 animate-in zoom-in-95 duration-1000">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {[
                { label: 'صافي القيمة الحالية (NPV)', value: formatCurrency(state.kpis.npv), color: state.kpis.npv > 0 ? 'text-emerald-600' : 'text-rose-600' },
                { label: 'معدل العائد الداخلي (IRR)', value: `${state.kpis.irr}%`, color: 'text-slate-900' },
                { label: 'نقاط الجدوى الإجمالية', value: `${state.kpis.viabilityScore}/100`, color: state.kpis.viabilityScore > 70 ? 'text-emerald-600' : 'text-amber-500' },
                { label: 'ثقة المستثمر النهائية', value: `${formatPercent(state.kpis.investorConfidence)}%`, color: 'text-indigo-600' }
              ].map((kpi, idx) => (
                <div key={idx} className="bg-white p-10 border border-slate-200/60 rounded-[2.5rem] text-center shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-4 block leading-none">{kpi.label}</span>
                  <p className={`text-3xl font-black mt-2 tabular-nums tracking-tight ${kpi.color}`}>
                    {kpi.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="bg-white border border-slate-200/60 rounded-[3.5rem] overflow-hidden shadow-2xl relative ring-1 ring-slate-100">
              <div className="bg-slate-900 px-12 py-14 flex flex-col md:flex-row justify-between items-center text-white relative">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none overflow-hidden">
                   <div className="absolute -top-1/2 -right-1/4 w-[100%] h-[200%] bg-indigo-500 rounded-full blur-[150px]"></div>
                </div>
                
                <div className="flex items-center gap-8 relative">
                  <div className="bg-indigo-600 p-5 rounded-[2rem] shadow-2xl shadow-indigo-600/30">
                    <FileText size={40} />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black tracking-tight leading-tight">تقرير لجنة الاستثمار النهائي</h2>
                    <p className="text-slate-400 font-bold text-sm uppercase mt-2 tracking-[0.2em] opacity-80">إدارة تقييم المخاطر والدراسات المالية الاستراتيجية</p>
                  </div>
                </div>
                <div className="mt-8 md:mt-0 px-6 py-2.5 bg-white/5 rounded-2xl border border-white/10 font-mono text-xs opacity-60 tracking-tighter">
                  ID_REFERENCE: FS-X2024-{state.projectType}
                </div>
              </div>
              
              <div className="p-16 lg:p-24 bg-gradient-to-b from-white to-slate-50/30">
                {isLoading ? (
                  <div className="py-32 flex flex-col items-center gap-8">
                     <div className="w-20 h-20 border-[6px] border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                     <p className="text-slate-500 text-2xl font-black animate-pulse tracking-tight">جاري صياغة مخرجات اللجنة العليا...</p>
                  </div>
                ) : (
                  <div className="prose prose-slate prose-xl max-w-none">
                    <div className="whitespace-pre-wrap text-slate-700 leading-relaxed font-medium space-y-8 text-xl">
                      {finalReport}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white border-t border-slate-100 p-14 lg:p-16 flex flex-col lg:flex-row justify-between items-center gap-12">
                <div className="flex items-center gap-10">
                  <div className="text-right">
                    <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.25em] mb-4">التوصية الرسمية</p>
                    <div className={`px-10 py-5 rounded-[2rem] text-2xl font-black shadow-lg transition-transform hover:scale-105 duration-500 flex items-center gap-4 ${state.kpis.npv > 0 && state.kpis.viabilityScore > 60 ? 'bg-emerald-50 text-emerald-800 border-2 border-emerald-200 shadow-emerald-900/5' : 'bg-rose-50 text-rose-800 border-2 border-rose-200 shadow-rose-900/5'}`}>
                      {state.kpis.npv > 0 && state.kpis.viabilityScore > 60 ? (
                        <>
                          <CheckCircle2 size={28} />
                          <span>اعتماد المشروع (GO)</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={28} />
                          <span>رفض الاستثمار (NO-GO)</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => window.location.reload()}
                  className="bg-slate-900 text-white px-14 py-6 rounded-[2.5rem] font-black text-2xl hover:bg-indigo-600 hover:shadow-[0_25px_60px_-15px_rgba(79,70,229,0.4)] transition-all active:scale-[0.98] flex items-center gap-4 group"
                >
                  بدء دراسة جدوى جديدة
                  <Activity size={24} className="group-hover:rotate-12 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-slate-900 border-t border-white/5 py-14 px-12 mt-24 text-white/40">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="flex items-center gap-5 group">
             <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 group-hover:border-indigo-500/50 group-hover:bg-indigo-500/10 transition-all duration-500">
                <PieChart size={24} className="group-hover:text-indigo-400" />
             </div>
             <div>
                <p className="text-sm font-black text-white/80 uppercase tracking-widest leading-none mb-1.5 group-hover:text-white transition-colors">محاكي دراسات الجدوى الاحترافي</p>
                <p className="text-[11px] font-bold opacity-50 tracking-tight">نسخة التحليل الاستراتيجي الرقمي v2.1.0 (2024)</p>
             </div>
          </div>
          <div className="flex gap-12">
            <div className="flex items-center gap-4 group cursor-help transition-opacity hover:opacity-100">
              <ShieldAlert size={18} className="text-white/20 group-hover:text-rose-500 transition-colors" />
              <span className="text-[11px] font-black uppercase tracking-widest group-hover:text-white/80 transition-colors">بروتوكول إدارة المخاطر ISO-31000</span>
            </div>
            <div className="flex items-center gap-4 group cursor-help transition-opacity hover:opacity-100">
              <BarChart3 size={18} className="text-white/20 group-hover:text-indigo-400 transition-colors" />
              <span className="text-[11px] font-black uppercase tracking-widest group-hover:text-white/80 transition-colors">تحليل الحساسية المالية Monte-Carlo</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
