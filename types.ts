
export enum ModuleType {
  INIT = 'INIT',
  TECHNICAL = 'TECHNICAL',
  MARKETING = 'MARKETING',
  FINANCIAL = 'FINANCIAL',
  FINAL_REPORT = 'FINAL_REPORT'
}

export interface ProjectDecision {
  id: string;
  category: string;
  question: string;
  options: DecisionOption[];
  context?: string;
}

export interface DecisionOption {
  id: string;
  label: string;
  description: string;
  impacts: {
    capex: number;
    opex: number;
    risk: number;
    marketShare: number;
    timeDelay: number;
    investorConfidence?: number;
  };
}

export interface MarketEvent {
  id: string;
  title: string;
  description: string;
  impactType: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  effectOn: 'TECHNICAL' | 'MARKETING' | 'FINANCIAL' | 'ALL';
  kpiImpacts: {
    riskIndex?: number;
    marketConfidence?: number;
    budgetImpact?: number;
  };
}

export interface SimulationState {
  currentModule: ModuleType;
  projectType: string;
  projectName: string;
  budget: number;
  spent: number;
  decisions: Record<string, string>;
  kpis: {
    npv: number;
    irr: number;
    riskIndex: number;
    marketConfidence: number;
    investorConfidence: number;
    viabilityScore: number;
    progress: number;
  };
  events: MarketEvent[];
  history: string[];
}
