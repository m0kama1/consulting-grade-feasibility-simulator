
import { GoogleGenAI, Type } from "@google/genai";
import { ModuleType, ProjectDecision, MarketEvent } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiService = {
  async generateProjectContext(projectType: string) {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `بصفتك مستشاراً أولاً لدراسات الجدوى، أنشئ ملخصاً احترافياً لمشروع ${projectType}. 
      يجب أن يتضمن: اسم شركة واقعي، سياق السوق لعام 2024، تحديات فنية دقيقة، و3 أهداف استراتيجية.
      يجب أن تكون اللغة العربية احترافية واقتصادية.
      Return in JSON format.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            projectName: { type: Type.STRING },
            companyName: { type: Type.STRING },
            context: { type: Type.STRING },
            objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
            initialBudget: { type: Type.NUMBER },
            marketConditions: { type: Type.STRING },
            techReadiness: { type: Type.STRING }
          },
          required: ["projectName", "companyName", "context", "objectives", "initialBudget"]
        }
      }
    });
    return JSON.parse(response.text);
  },

  async generateModuleDecisions(moduleType: ModuleType, projectContext: any): Promise<ProjectDecision[]> {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `أنشئ 4 قرارات استراتيجية حرجة لنموذج الجدوى ${moduleType} لمشروع ${projectContext.projectName}.
      يجب أن يكون لكل قرار 3 خيارات احترافية مع مقايضات مالية وفنية واقعية.
      القرارات يجب أن تعكس تعقيدات حقيقية (مثلاً: اختيار التكنولوجيا، استراتيجية التسعير، هيكلة رأس المال).
      اللغة: العربية الفصحى الاحترافية.
      Return JSON format.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              category: { type: Type.STRING },
              question: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    label: { type: Type.STRING },
                    description: { type: Type.STRING },
                    impacts: {
                      type: Type.OBJECT,
                      properties: {
                        capex: { type: Type.NUMBER },
                        opex: { type: Type.NUMBER },
                        risk: { type: Type.NUMBER },
                        marketShare: { type: Type.NUMBER },
                        timeDelay: { type: Type.NUMBER },
                        investorConfidence: { type: Type.NUMBER }
                      },
                      required: ["capex", "opex", "risk", "marketShare", "timeDelay", "investorConfidence"]
                    }
                  },
                  required: ["id", "label", "description", "impacts"]
                }
              }
            },
            required: ["id", "category", "question", "options"]
          }
        }
      }
    });
    return JSON.parse(response.text);
  },

  async generateRandomEvent(state: any): Promise<MarketEvent> {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `أنشئ حدثاً طارئاً (اقتصادي، سياسي، تقني، أو بيئي) يؤثر على دراسة الجدوى لمشروع ${state.projectName}.
      يجب أن يكون للحدث تأثير ملموس على المخاطر أو الثقة أو الميزانية.
      اللغة: العربية.
      Return JSON format.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            impactType: { type: Type.STRING, enum: ["POSITIVE", "NEGATIVE", "NEUTRAL"] },
            effectOn: { type: Type.STRING, enum: ["TECHNICAL", "MARKETING", "FINANCIAL", "ALL"] },
            kpiImpacts: {
              type: Type.OBJECT,
              properties: {
                riskIndex: { type: Type.NUMBER },
                marketConfidence: { type: Type.NUMBER },
                budgetImpact: { type: Type.NUMBER }
              }
            }
          },
          required: ["id", "title", "description", "impactType", "effectOn", "kpiImpacts"]
        }
      }
    });
    return JSON.parse(response.text);
  },

  async evaluateFinalReport(state: any) {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `بصفتك لجنة استثمار عليا، حلل دراسة الجدوى النهائية لمشروع ${state.projectName}.
      البيانات المالية: NPV=${state.kpis.npv}, IRR=${state.kpis.irr}%.
      المؤشرات: مخاطر=${state.kpis.riskIndex}، ثقة المستثمرين=${state.kpis.investorConfidence}.
      اكتب تقريراً تنفيذياً مفصلاً بالعربية يغطي:
      1. التحليل المالي والجدوى الاقتصادية.
      2. تقييم جودة القرارات المتخذة.
      3. تحليل الحساسية والمخاطر.
      4. التوصية النهائية (قبول/رفض/تعديل) مع المبررات.
      استخدم لغة تقرير رسمي عالي المستوى.`,
      config: {
        thinkingConfig: { thinkingBudget: 4000 }
      }
    });
    return response.text;
  }
};
