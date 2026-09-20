import { DEMO_PACK } from './data/demo-pack.js';
import { GIS_PACK } from './data/gis-pack.js';
import { CONTRACT_TWIN_PACK } from './data/contract-twin-pack.js';

/*
 * RailMind Control Tower preview.
 *
 * Every number rendered here comes from DEMO_PACK, which is generated from the
 * deterministic engine in src/ (see src/web/demo-pack.ts). This file owns only
 * presentation: bilingual labels, layout, and local interaction state. It never
 * calculates a KPI, invents a value, or writes to an external system.
 */

/* Static fallback until the API delivers the live Control Tower DTO. Both come from the same application service. */
let pack = DEMO_PACK;
let dataSource = 'static';
/* GIS view: the synthetic schematic joined with the Control Tower DTO by src/gis/service.ts. Positions are canvas percentages, never coordinates. */
let gisPack = GIS_PACK;
/* Contract digital twin evaluated by src/contract-twin/service.ts against the same DTO. Demo twin: synthetic clauses, never contractual. */
let twinPack = CONTRACT_TWIN_PACK;

const state = {
  language: 'ar',
  compact: false,
  /* Live decision state from the local API. Null until /api/report responds; the static pack is the fallback. */
  live: { available: false, report: null, readiness: null, audit: [], ledger: [], chain: null, persistence: null },
  /* Authenticated principal from /api/auth/me. Token kept in sessionStorage only. */
  auth: { token: null, principal: null, permissions: [], mode: null, identities: [] },
  /* Registered report packages from /api/reports and the one the UI addresses. Null selects the deployment default. */
  reports: { list: [], selected: null },
  telemetry: { active: true, timer: null, index: pack.timeline.length - 1, eventId: 0, lastSignalAt: null },
  gis: { zoom: 1, filter: 'all', layers: { assets: true, faults: true, workorders: true, trains: true }, selected: null, eventLabel: null, train: { cycle: 0, active: 'train-r01', lastEvent: null } },
  /* Predictive signals come from the failure-risk agent through the API; the browser never scores anything. */
  predictive: { loadedAt: null, assessments: null, runRef: null },
};

/* ---------- Presentation metadata (labels only, no numbers) ---------- */

const kpiLabels = {
  availability: { ar: 'التوافر التشغيلي', en: 'Operational availability', precision: 3, icon: '◒' },
  failures: { ar: 'حالات العطل', en: 'Failure count', precision: 0, icon: '◌' },
  mtbf: { ar: 'متوسط الزمن بين الأعطال', en: 'Mean time between failures', precision: 2, icon: '◌' },
  mttr: { ar: 'متوسط زمن الإصلاح', en: 'Mean time to repair', precision: 2, icon: '△' },
  backlog: { ar: 'الأعمال المتراكمة', en: 'Maintenance backlog', precision: 0, icon: '◌' },
  pm_compliance: { ar: 'الالتزام بالصيانة الوقائية', en: 'PM compliance', precision: 1, icon: '◷' },
};
const unitLabels = { '%': { ar: '%', en: '%' }, count: { ar: '', en: '' }, hours: { ar: 'س', en: 'h' }, 'work orders': { ar: 'أمر', en: 'WO' } };
const assetLabels = {
  'ATC-ZC-01': { arClass: 'إشارات / تحكم آلي بالقطارات', enClass: 'Signalling / ATC', arLocation: 'خط المترو', enLocation: 'Metro line' },
  'ATC-ZC-02': { arClass: 'إشارات / تحكم آلي بالقطارات', enClass: 'Signalling / ATC', arLocation: 'خط المترو', enLocation: 'Metro line' },
  'TRAM-APS-03': { arClass: 'تغذية كهربائية', enClass: 'Traction power', arLocation: 'الترام', enLocation: 'Tram' },
};
const agentLabels = {
  'data-quality': { ar: 'وكيل جودة البيانات', arDetail: 'يتحقق من الاكتمال والطوابع الزمنية وجودة المصدر', enDetail: 'Validates completeness, timestamps, and source quality' },
  'asset-intelligence': { ar: 'وكيل ذكاء الأصول', arDetail: 'يفسر صحة الأصل ومحركات الأعطال', enDetail: 'Explains asset health and failure drivers' },
  'maintenance-kpi': { ar: 'وكيل مؤشرات الصيانة', arDetail: 'يشرح نتائج الصيغ الحتمية المحسوبة خارج نموذج اللغة', enDetail: 'Explains deterministic results computed outside the language model' },
  reporting: { ar: 'وكيل التقارير', arDetail: 'يصوغ السرد بعد اعتماد KPI', enDetail: 'Drafts narrative after KPI approval' },
  'executive-briefing': { ar: 'وكيل الموجز التنفيذي', arDetail: 'يحوّل الاستثناءات المعتمدة إلى قرارات مطلوبة', enDetail: 'Turns approved exceptions into decisions required' },
  'contract-context': { ar: 'وكيل سياق العقد', arDetail: 'يسترجع البنود والحدود وقواعد الأدلة المعتمدة', enDetail: 'Retrieves approved clauses, thresholds and evidence rules' },
  'finance-context': { ar: 'وكيل سياق المالية', arDetail: 'يسترجع حالة الفواتير وسير العمل', enDetail: 'Retrieves invoice and workflow status' },
};
/* Demo routing defaults by severity. These are presentation defaults, not contract rules. */
const routing = {
  critical: { arOwner: 'حوكمة الصيانة', enOwner: 'Maintenance governance', arDue: 'مراجعة خلال 4 ساعات', enDue: 'Review within 4 hours' },
  high: { arOwner: 'فريق الأداء', enOwner: 'Performance team', arDue: 'قرار قبل نهاية اليوم', enDue: 'Decision before close of day' },
  watch: { arOwner: 'تخطيط الصيانة', enOwner: 'Maintenance planning', arDue: 'متابعة خلال يوم عمل', enDue: 'Follow up within one business day' },
};

const en = {
  pilot:'Safe pilot mode', navControl:'Control Tower', navNetwork:'Network GIS', navExceptions:'Exception Centre', navAssets:'Asset Intelligence', navContract:'Contract Performance', navReports:'Reports Workspace', navAgents:'Agent Workspace', navPortfolio:'Portfolio Intelligence', portfolioKicker:'SANITISED PORTFOLIO ANALYTICS', portfolioTitle:'Portfolio intelligence', portfolioText:'Explore aggregated budget, expenditure and award-status insight. No source-system connection or external write exists.', portfolioBoundaryTitle:'Aggregated read-only data', portfolioBoundaryCopy:'Generalised data · no organisation, vendor, or initiative identifiers', guardrailTitle:'Decision safeguards', guardrailNav:'Read, analyse, and draft only', userName:'Ahmed Zaian', userRole:'Decision owner', search:'Search or open command', compact:'Compact view', eyebrow:'CONTROL TOWER · INTELLIGENT OPERATIONS', greeting:'Good morning, Ahmed', tagline:'Evidence-led operations, not impressions', synthetic:'Safe illustrative data for testing', updated:'Last updated', executiveView:'EXECUTIVE VIEW', heroTitle:'Today’s picture is clear.', heroText:'Move from exception to a clear decision with a complete trail for source, reviewer, and approval.', refresh:'Refresh view', scopeLabel:'Current scope', scopeRed:'Pilot scope · Red Line', scopeTram:'Pilot scope · Dubai Tram', scopeDepot:'Pilot scope · Al Qusais Depot', periodLabel:'Analysis window', periodMonth:'This month', period30:'Last 30 days', periodLocked:'Locked report period', boundaryTitle:'P0 boundary', boundaryText:'Read, analyse, and draft only. No operational control or autonomous external write.', priorityDecisions:'Priority decisions', priorityText:'Rank exceptions by consequence and urgency, then open evidence before any decision is approved.', viewAll:'View all', signalSummary:'Signal summary', signalText:'The priority now: protect decision clarity before increasing automation scale.', signalSource:'Based on a traceable illustrative pack', openBrief:'Open decision brief', openBriefText:'Evidence, assumptions, and approval status', performancePulse:'Performance pulse', performanceText:'The illustrative trajectory is stable, with one evidence-linked watch point.', availability:'Availability', watchPoint:'Watch point', week1:'Week 1', week2:'Week 2', week3:'Week 3', today:'Today', evidenceChain:'Evidence chain', evidenceText:'Trace a conclusion from narrative to metric, source record, and timestamp.', sourceRecord:'Source record', governedMetric:'Governed metric', pmBacklog:'Maintenance backlog', recommendationDraft:'Recommendation draft', awaitingReview:'Awaiting human review', safeWorkspace:'SAFEGUARDED WORKSPACE', agentWorkspace:'Agent workspace', agentText:'Request analysis, then inspect assumptions and evidence before using any draft.', waiting:'Waiting for your request', suggestedQuestions:'Suggested questions', qAttention:'What decision is required today?', qEvidence:'Check evidence completeness', qBreaches:'Show KPI breaches', qReport:'Is the monthly report ready?', qBriefing:'Prepare the executive briefing', agentPlaceholder:'Example: Summarise PM backlog drivers in the Red Line scope', runAnalysis:'Run safeguarded analysis', agentFooter:'No high-impact decision is released before named human approval.', priorityQueue:'PRIORITY QUEUE', exceptionCentre:'Exception Centre', maximoLinked:'MAXIMO-LINKED', assetIntelligence:'Asset Intelligence', sharedTruth:'SHARED CONTRACT TRUTH', contractPerformance:'Contract Performance', approvedData:'GENERATED FROM APPROVED DATA', reportingCentre:'Reporting Centre', governedAgents:'GOVERNED MULTI-AGENT SYSTEM', askRailmind:'ASK RAILMIND', decisionQuery:'Decision query', queryInitial:'Choose a decision question. Demo answers are deterministic and grounded in synthetic data.', decisionPack:'Decision pack',
};
const ar = {
  details:'التفاصيل', action:'مطلوب إجراء', source:'المصدر', observed:'وقت الرصد', quality:'حالة الجودة', verified:'تم التحقق', recommendation:'التوصية المقترحة', governance:'حاجز الحوكمة', requestReview:'إرسال للمراجعة البشرية', reviewReady:'تم تجهيز الطلب للمراجعة البشرية فقط', reviewNote:'يتطلب الاعتماد اسم المراجع والدور والتوقيت قبل اعتبار المخرج جاهزاً.', noWrite:'لا ينفذ هذا العرض أي أمر عمل أو رسالة أو تغيير في نظام مصدر.', analysisReady:'مسودة جاهزة للمراجعة', working:'يجري تجهيز المسودة...', guardrail:'واجهة P0 للقراءة والتحليل والصياغة فقط. لا توجد كتابة خارجية تلقائية.', refreshed:'تم تحديث العرض التجريبي', compactOn:'تم تفعيل العرض المبسط', compactOff:'تم إلغاء العرض المبسط', notify:'لا توجد تنبيهات غير مقروءة في العرض التجريبي.', severity:{critical:'حرج',high:'مرتفع',watch:'متابعة',good:'ضمن النطاق'}, target:'المستهدف', within:'ضمن الحد التجريبي', below:'أقل من المستهدف التجريبي', above:'أعلى من الحد التجريبي', watchTrend:'نقطة متابعة', formula:'إصدار الصيغة', evidenceCount:'سجلات مصدر', asOf:'كما في', replay:'إعادة تشغيل الفترة', engineLabel:'محسوب بمحرك KPI الحتمي', exceptionId:'معرّف الاستثناء', kpiWithin:'المؤشر ضمن المستهدف ولا يوجد استثناء مفتوح.', reportMonthly:'تقرير الأداء الشهري', reportQuarterly:'المراجعة التنفيذية الفصلية', reportAnnual:'تقرير الأصول والعقد السنوي', reportNotGenerated:'لم يتم التوليد', twinTitle:'التوأم الرقمي للعقد', twinCopy:'التزامات وواجبات إبلاغ منسوخة من مستودع العقد ومقيّمة مقابل حقائق برج التحكم. لا يعيد النظام تعريف أي بند أو حد.', twinDemo:'توأم تجريبي: بنود اصطناعية للعرض فقط وليست مرجعاً تعاقدياً', twinContractual:'توأم معتمد', obligation:'الالتزام', clause:'البند', obligationOwner:'المسؤول', evaluation:'التقييم', reason:'السبب', reportingDuties:'واجبات الإبلاغ', dueAt:'موعد الاستحقاق', twinNone:'لا يوجد توأم رقمي منشور لهذا العقد', obligationStatus:{met:'مستوفى',breached:'خرق',not_decision_grade:'غير صالح للقرار',unavailable:'غير متاح',not_effective:'غير ساري',not_evaluated:'غير مقيّم'}, dutyStatus:{met:'مستوفى',due:'مستحق',overdue:'متأخر'}, ownerLabel:{owner:'المالك',contractor:'المقاول',both:'الطرفان'}, obligationKind:{kpi:'مؤشر',reporting:'إبلاغ',evidence:'دليل',response:'استجابة',payment:'دفع'}, selectReport:'اختيار الحزمة', currentReport:'الحزمة الحالية', reportSummary:'ملخص تنفيذي حتمي', approvalGate:'بوابة الاعتماد', nextStep:'الانتقال التالي المسموح', blockers:'موانع', noBlockers:'لا توجد موانع، الحزمة جاهزة للإرسال إلى مراجعة مُسمّاة.', status:{draft:'مسودة · مراجعة بشرية مطلوبة',under_review:'قيد المراجعة',approved:'معتمد',rejected:'مرفوض',superseded:'مُلغى بتغيّر الأدلة',locked:'مغلق'}, transition:{submit_for_review:'إرسال للمراجعة',approve:'اعتماد',reject:'رفض',lock:'إغلاق الفترة',supersede:'إلغاء بتغيّر الأدلة',revise:'إعادة إلى المسودة'}, approvalValid:'الاعتماد يطابق الأدلة الحالية', approvalStale:'الاعتماد لا يطابق الأدلة الحالية', evidenceVersion:'إصدار الأدلة', ledgerTitle:'سجل القرارات', ledgerCols:['#','النوع','الفاعل','الوقت','إصدار الأدلة','الأدلة'], telemetryTitle:'إعادة تشغيل حتمية لأحداث الفترة', telemetrySource:'محاكاة محلية · إعادة حساب المؤشرات عند كل سجل', telemetryPaused:'إعادة التشغيل متوقفة مؤقتاً', telemetryLast:'آخر إشارة', telemetryReady:'جاهز للبدء', telemetryPausedAt:'متوقف مؤقتاً', telemetryStop:'إيقاف التدفق', telemetryStart:'استئناف التدفق', telemetryReset:'تمت إعادة الضبط إلى إغلاق الفترة', telemetryEventPrefix:'TLM', periodClose:'إغلاق الفترة', deterministicModes:'حتمي', modelModes:'قد يستخدم نموذجاً', humanGate:'بوابة بشرية', workOrdersSeen:'أوامر عمل مرصودة', identity:'الهوية المُسمّاة للإجراء', actorId:'معرّف المراجع', actorRole:'الدور', note:'ملاحظة المراجعة أو المعالجة', auditTrail:'سجل التدقيق', chainValid:'سلسلة التجزئة سليمة', chainBroken:'سلسلة التجزئة مكسورة عند', noAudit:'لا توجد أحداث تدقيق بعد.', apiOffline:'واجهة القرار غير متاحة (عرض ثابت). البوابة للقراءة فقط وتُعرض من الحزمة المولّدة.', persistence:{'in-memory':'تخزين في الذاكرة · يُعاد ضبطه عند إعادة التشغيل', postgres:'تخزين دائم PostgreSQL'}, transitionDone:'تم تنفيذ الانتقال وتسجيله في سجل التدقيق', transitionRefused:'رُفض الانتقال وسُجّل الرفض', resetDone:'تمت استعادة الحزمة التجريبية', reset:'استعادة الحزمة التجريبية', auditCols:['#','الإجراء','الفاعل','الوقت','الحالة','التجزئة'], planned:'تم تخطيط التشغيل وتسجيله', blocked:'تم منع التشغيل وتسجيل المنع', agentPlan:'خطة التنفيذ المحكومة', tools:'الأدوات المسموح بها', policy:'قرار السياسة', approvalNeeded:'يتطلب اعتماداً بشرياً مُسمى', noApproval:'ضمن حدود القراءة والتحليل', auditRef:'مرجع التدقيق', submitViaDrawer:'أُرسلت حزمة التقرير إلى المراجعة المُسمّاة', runStatus:{completed:'اكتمل',blocked:'مُنع',failed:'فشل'}, runOutput:'المخرج الموثق', runEvidence:'سجلات دليل', runAssumptions:'الافتراضات', runTools:'استدعاءات الأدوات', runModel:'استخدام النموذج', runModelYes:'نعم (سرد فقط)', runModelNo:'لا، مخرج حتمي', releaseReady:'جاهز للإصدار', awaitingApproval:'بانتظار اعتماد مُسمى', runCapability:'القدرة', runReason:'السبب', signIn:'تسجيل الدخول', signOut:'تسجيل الخروج', signedInAs:'مسجّل الدخول باسم', chooseIdentity:'اختر هوية تجريبية (وضع العرض الاصطناعي)', tokenLabel:'رمز الوصول', tokenPlaceholder:'الصق رمز الوصول', signInFailed:'فشل تسجيل الدخول: الرمز غير صالح', signedIn:'تم تسجيل الدخول', signedOut:'تم تسجيل الخروج', notSignedIn:'غير مسجّل الدخول', permissionDenied:'الدور الحالي لا يملك هذه الصلاحية', authDemo:'مصادقة تجريبية · رموز عامة للعرض الاصطناعي فقط', authToken:'مصادقة برموز مُجزّأة', role:{viewer:'مشاهد',maintenance_engineer:'مهندس صيانة',reliability_engineer:'مهندس موثوقية',contract_manager:'مدير عقد',finance_reviewer:'مراجع مالي',approver:'معتمِد',administrator:'مسؤول النظام'}, runAssetHealth:'شغّل تقييم صحة الأصول', assetHealthTitle:'صحة الأصول ومخاطر الأعطال', assetHealthCopy:'محرك RailMind الموروث: مؤشر صحة، درجة مخاطر مع محركاتها، وتوصية خلف بوابة مراجعة المهندس. الأوزان تجريبية غير معايرة.', healthBand:{healthy:'سليم',watch:'متابعة',critical:'حرج'}, riskBandLabel:{low:'منخفض',medium:'متوسط',high:'مرتفع'}, actionLabel:{inspect:'فحص',schedule_pm:'جدولة صيانة وقائية',replace_component:'استبدال مكوّن',monitor:'مراقبة'}, withinHours:'خلال', hours:'ساعة', drivers:'المحركات', engineerReview:'يتطلب مراجعة مهندس مُسمى', meanHealth:'متوسط الصحة', highRiskCount:'مخاطر مرتفعة', awaitingReviewCount:'بانتظار مراجعة', signInFirst:'سجّل الدخول بدور مهندس أو أعلى لتشغيل التقييم', readiness:{READY:'جاهز للقرار',PROVISIONAL:'مؤقت',BLOCKED:'محجوب'}, readinessTitle:'جاهزية البيانات', sourceStatic:'حزمة ثابتة مولّدة من خدمة التطبيق (بلا API)', sourceLive:'DTO حي من خدمة برج التحكم', freshness:'حداثة المصدر', ageHours:'ساعة منذ آخر سجل', records:'سجلات', readinessIssues:'ملاحظات الجاهزية',
};
const enExtra = {
  details:'Details', action:'Action required', source:'Source', observed:'Observed at', quality:'Quality state', verified:'Verified', recommendation:'Proposed recommendation', governance:'Governance guardrail', requestReview:'Request human review', reviewReady:'Request prepared for human review only', reviewNote:'A reviewer name, role, and timestamp are required before an output is considered ready.', noWrite:'This demonstration never creates a work order, message, or source-system change.', analysisReady:'Draft ready for review', working:'Preparing your draft...', guardrail:'P0 interface for read, analyse, and draft only. No autonomous external write exists.', refreshed:'Illustrative view refreshed', compactOn:'Compact view enabled', compactOff:'Compact view disabled', notify:'No unread notifications in the illustrative view.', severity:{critical:'Critical',high:'High',watch:'Watch',good:'Within range'}, target:'Target', within:'Within demo target', below:'Below demo target', above:'Above demo limit', watchTrend:'Watch point', formula:'Formula version', evidenceCount:'source records', asOf:'As of', replay:'Period replay', engineLabel:'Computed by the deterministic KPI engine', exceptionId:'Exception id', kpiWithin:'KPI is within target and no exception is open.', reportMonthly:'Monthly Performance Report', reportQuarterly:'Quarterly Executive Review', reportAnnual:'Annual Asset & Contract Report', reportNotGenerated:'Not generated', twinTitle:'Contract digital twin', twinCopy:'Obligations and reporting duties copied from the contract repository and evaluated against Control Tower facts. Nothing here redefines a clause or a threshold.', twinDemo:'Demo twin: synthetic clauses for the preview only, not a contractual authority', twinContractual:'Approved twin', obligation:'Obligation', clause:'Clause', obligationOwner:'Owner', evaluation:'Evaluation', reason:'Reason', reportingDuties:'Reporting duties', dueAt:'Due', twinNone:'No digital twin is published for this contract', obligationStatus:{met:'Met',breached:'Breached',not_decision_grade:'Not decision-grade',unavailable:'Unavailable',not_effective:'Not effective',not_evaluated:'Not evaluated'}, dutyStatus:{met:'Met',due:'Due',overdue:'Overdue'}, ownerLabel:{owner:'Owner',contractor:'Contractor',both:'Both parties'}, obligationKind:{kpi:'KPI',reporting:'Reporting',evidence:'Evidence',response:'Response',payment:'Payment'}, selectReport:'Select package', currentReport:'Current package', reportSummary:'Deterministic executive summary', approvalGate:'Approval gate', nextStep:'Next allowed transition', blockers:'Blockers', noBlockers:'No blockers. The package is ready for submission to a named review.', status:{draft:'Draft · human review required',under_review:'Under review',approved:'Approved',rejected:'Rejected',superseded:'Superseded by evidence change',locked:'Locked'}, transition:{submit_for_review:'Submit for review',approve:'Approve',reject:'Reject',lock:'Lock period',supersede:'Supersede (evidence changed)',revise:'Return to draft'}, approvalValid:'Approval matches the current evidence', approvalStale:'Approval no longer matches the current evidence', evidenceVersion:'Evidence version', ledgerTitle:'Decision ledger', ledgerCols:['#','Kind','Actor','At','Evidence version','Evidence'], telemetryTitle:'Deterministic replay of period events', telemetrySource:'Local simulation · KPIs recomputed at each record', telemetryPaused:'Replay paused', telemetryLast:'Last signal', telemetryReady:'Ready to start', telemetryPausedAt:'Paused', telemetryStop:'Pause stream', telemetryStart:'Resume stream', telemetryReset:'Reset to period close', telemetryEventPrefix:'TLM', periodClose:'Period close', deterministicModes:'Deterministic', modelModes:'May use a model', humanGate:'Human gate', workOrdersSeen:'work orders observed', identity:'Named identity for the action', actorId:'Reviewer id', actorRole:'Role', note:'Review or mitigation note', auditTrail:'Audit trail', chainValid:'Hash chain intact', chainBroken:'Hash chain broken at', noAudit:'No audit events yet.', apiOffline:'Decision API unavailable (static preview). The gate is read-only and rendered from the generated pack.', persistence:{'in-memory':'In-memory storage · resets on restart', postgres:'Durable PostgreSQL storage'}, transitionDone:'Transition executed and recorded in the audit trail', transitionRefused:'Transition refused and the refusal recorded', resetDone:'Demo package restored', reset:'Restore demo package', auditCols:['#','Action','Actor','At','State','Hash'], planned:'Run planned and audited', blocked:'Run blocked and audited', agentPlan:'Governed execution plan', tools:'Allowed tools', policy:'Policy decision', approvalNeeded:'Named human approval required', noApproval:'Within the read/analyse boundary', auditRef:'Audit reference', submitViaDrawer:'Report package submitted for named review', runStatus:{completed:'Completed',blocked:'Blocked',failed:'Failed'}, runOutput:'Grounded output', runEvidence:'evidence records', runAssumptions:'Assumptions', runTools:'Tool calls', runModel:'Model use', runModelYes:'Yes (narrative only)', runModelNo:'No, deterministic output', releaseReady:'Release ready', awaitingApproval:'Awaiting named approval', runCapability:'Capability', runReason:'Reason', signIn:'Sign in', signOut:'Sign out', signedInAs:'Signed in as', chooseIdentity:'Choose a demo identity (synthetic preview mode)', tokenLabel:'Access token', tokenPlaceholder:'Paste an access token', signInFailed:'Sign-in failed: token not recognised', signedIn:'Signed in', signedOut:'Signed out', notSignedIn:'Not signed in', permissionDenied:'The current role lacks this permission', authDemo:'Demo authentication · public tokens for the synthetic preview only', authToken:'Hashed-token authentication', role:{viewer:'Viewer',maintenance_engineer:'Maintenance engineer',reliability_engineer:'Reliability engineer',contract_manager:'Contract manager',finance_reviewer:'Finance reviewer',approver:'Approver',administrator:'Administrator'}, runAssetHealth:'Run asset health assessment', assetHealthTitle:'Asset health and failure risk', assetHealthCopy:'Migrated RailMind engine: health index, risk score with named drivers, and a recommendation behind the engineer-review gate. Weights are demo values, not calibrated.', healthBand:{healthy:'Healthy',watch:'Watch',critical:'Critical'}, riskBandLabel:{low:'Low',medium:'Medium',high:'High'}, actionLabel:{inspect:'Inspect',schedule_pm:'Schedule PM',replace_component:'Replace component',monitor:'Monitor'}, withinHours:'within', hours:'h', drivers:'Drivers', engineerReview:'Named engineer review required', meanHealth:'Mean health', highRiskCount:'High risk', awaitingReviewCount:'Awaiting review', signInFirst:'Sign in as engineer or above to run the assessment', readiness:{READY:'Decision-grade',PROVISIONAL:'Provisional',BLOCKED:'Blocked'}, readinessTitle:'Data readiness', sourceStatic:'Static pack generated by the application service (no API)', sourceLive:'Live DTO from the Control Tower service', freshness:'Source freshness', ageHours:'h since latest record', records:'records', readinessIssues:'Readiness notes',
};

/* ---------- Helpers ---------- */

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const isAr = () => state.language === 'ar';
const L = () => (isAr() ? ar : { ...en, ...enExtra });
const tx = (key) => L()[key] ?? key;
const pick = (obj, key) => obj[`${state.language}${key}`] ?? obj[state.language] ?? '';
const status = (value) => `<span class="status-pill status-pill--${value}"><i>●</i>${tx('severity')[value]}</span>`;
const unit = (u) => (unitLabels[u] ?? { ar: u, en: u })[state.language];
const locale = () => (isAr() ? 'ar-AE' : 'en-GB');
const fmtDate = (iso) => new Date(iso).toLocaleString(locale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
const fmtValue = (id, value) => { const p = kpiLabels[id]?.precision ?? 2; return p === 0 ? String(Math.round(value)).padStart(2, '0') : Number(value).toFixed(p); };
const directionSign = (d) => (d === 'higher_is_better' ? '≥' : d === 'lower_is_better' ? '≤' : '=');
const targetText = (k) => (k.threshold === null ? '' : `${directionSign(k.direction)} ${k.threshold}${unit(k.unit)}`);
const cardStatus = (k) => (k.status === 'within_target' ? 'good' : k.status === 'watch' ? 'watch' : k.severity === 'critical' ? 'critical' : 'high');
const kpiName = (id) => kpiLabels[id]?.[state.language] ?? id;
const exceptionCode = (exception) => `EXC-${exception.kpiId.toUpperCase()}`;
const evidenceRange = (evidence) => { if (!evidence.length) return '—'; const ids = evidence.map((e) => e.entityId); return ids.length > 2 ? `${ids[0]}…${ids[ids.length - 1]} (${ids.length})` : ids.join(', '); };
const sourceLabel = (evidence) => { const src = evidence[0]?.sourceSystem ?? 'railmind'; return `${src === 'maximo' ? 'Maximo Demo' : src} · ${evidenceRange(evidence)}`; };
const criticalCount = () => pack.controlTower.criticalExceptions;
const openWorkOrders = () => pack.workOrders.filter((wo) => !['COMP', 'CLOSE', 'CAN'].includes(wo.status.toUpperCase())).length;

function trendText(k) {
  if (k.status === 'within_target') return tx('within');
  if (k.status === 'watch') return tx('watchTrend');
  return k.direction === 'higher_is_better' ? tx('below') : tx('above');
}

function exceptionCopy(exception) {
  const k = pack.kpis.find((item) => item.id === exception.kpiId);
  if (!k || exception.kind === 'readiness') {
    return isAr()
      ? { title: 'جاهزية البيانات محجوبة', detail: exception.whyItMatters, decision: exception.decisionRequired ?? 'عالج مشاكل بيانات المصدر قبل أي استنتاج تعاقدي.', alt: exception.title }
      : { title: exception.title, detail: exception.whyItMatters, decision: exception.decisionRequired ?? '', alt: 'جاهزية البيانات محجوبة' };
  }
  const value = `${fmtValue(k.id, k.value)}${unit(k.unit)}`;
  const target = targetText(k);
  const name = kpiName(k.id);
  if (isAr()) {
    const title = exception.severity === 'critical' ? `خرق متكرر لمؤشر ${name}` : `خرق مؤشر ${name}`;
    const detail = `${name} عند ${value} مقابل حد تجريبي ${target}. ${exception.severity === 'critical' ? 'تم التصعيد إلى حرج بسبب خروق سابقة مسجلة.' : 'يجب التحقق من تصنيف البيانات قبل اعتماد أي إجراء.'}`;
    const decision = exception.severity === 'critical' ? 'يلزم مراجعة مالك صيانة أو عقد مُسمى للسبب الجذري والمعالجة قبل اعتماد التقرير.' : 'راجع السبب والأدلة والإجراء التصحيحي خلال دورة التقرير الحالية.';
    return { title, detail, decision, alt: exception.title };
  }
  return { title: exception.title, detail: exception.whyItMatters, decision: exception.decisionRequired ?? '', alt: `خرق مؤشر ${name}` };
}

/* ---------- Renderers ---------- */

function currentSnapshot() { return pack.timeline[state.telemetry.index]; }

function renderKpis() {
  const snapshot = currentSnapshot();
  $('#kpi-grid').innerHTML = pack.kpis.map((k) => {
    const live = snapshot.kpis.find((item) => item.id === k.id);
    const view = { ...k, value: live.value, status: live.status };
    const cls = cardStatus(view);
    return `<article class="metric-card metric-card--${cls}" data-kpi="${k.id}" tabindex="0" role="button"><div class="metric-top"><span class="metric-icon">${kpiLabels[k.id].icon}</span><span class="metric-trend"><i></i>${trendText(view)}</span></div><strong><span class="metric-value">${fmtValue(k.id, view.value)}</span><small>${unit(k.unit)}</small></strong><b>${kpiName(k.id)}</b><small class="metric-secondary">${tx('target')} ${targetText(k)} · ${k.formulaVersion}</small><small class="metric-readiness metric-readiness--${k.readiness?.state ?? 'READY'}" title="${(k.readiness?.reasons ?? []).join(' ')}">${tx('readiness')[k.readiness?.state ?? 'READY']}</small><span class="metric-rule"></span><span class="metric-live" aria-hidden="true"></span></article>`;
  }).join('');
  $$('[data-kpi]').forEach((card) => {
    card.addEventListener('click', () => openDecision(card.dataset.kpi));
    card.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDecision(card.dataset.kpi); } });
  });
}

function renderDecisions() {
  $('#decision-list').innerHTML = pack.exceptions.map((x, i) => {
    const copy = exceptionCopy(x);
    const route = routing[x.severity];
    return `<article class="decision-item decision-item--${x.severity}"><span class="decision-rail"></span><span class="decision-index">0${i + 1}</span><div class="decision-content"><div class="decision-title"><div><b>${copy.title}</b><small>${copy.alt}</small></div>${status(x.severity)}</div><p>${copy.detail}</p><div class="decision-meta"><span>⌁ ${pick(route, 'Owner')}</span><span>◷ ${pick(route, 'Due')}</span><span dir="ltr">${exceptionCode(x)}</span></div></div><button class="decision-action" data-decision="${x.kpiId}" type="button">${isAr() ? 'اعرض الأدلة' : 'Open evidence'} <i>‹</i></button></article>`;
  }).join('');
  $$('[data-decision]').forEach((b) => b.addEventListener('click', () => openDecision(b.dataset.decision)));
}

function renderExceptionTable() {
  $('#exception-count').textContent = `${pack.exceptions.length} ${isAr() ? 'مفتوحة' : 'open'}`;
  const h = isAr() ? ['الحالة', 'الاستثناء', 'الأدلة', 'الإجراء المطلوب'] : ['Severity', 'Exception', 'Evidence', 'Decision required'];
  $('#exception-table').innerHTML = `<div class="data-table"><div class="table-row table-head">${h.map((v) => `<span>${v}</span>`).join('')}</div>${pack.exceptions.map((x) => { const copy = exceptionCopy(x); return `<div class="table-row"><span>${status(x.severity)}</span><span><b>${copy.title}</b><small>${copy.detail}</small></span><span dir="ltr">${sourceLabel(x.evidence)}</span><span>${copy.decision}</span></div>`; }).join('')}</div>`;
}

function renderAssets() {
  const h = isAr() ? ['الأصل', 'الفئة', 'الموقع', 'أوامر مفتوحة', 'أعطال', 'توقف (دقيقة)'] : ['Asset', 'Class', 'Location', 'Open WOs', 'Failures', 'Downtime (min)'];
  $('#asset-table').innerHTML = `<div class="data-table asset-table"><div class="table-row table-head">${h.map((v) => `<span>${v}</span>`).join('')}</div>${pack.assets.map((a) => { const meta = assetLabels[a.assetId] ?? { arClass: '—', enClass: '—', arLocation: '—', enLocation: '—' }; return `<div class="table-row"><span><b dir="ltr">${a.assetId}</b></span><span>${pick(meta, 'Class')}</span><span>${pick(meta, 'Location')}</span><span>${a.openWorkOrders}</span><span>${a.failureWorkOrders}</span><span>${a.downtimeMinutes}</span></div>`; }).join('')}</div><section class="asset-health" id="asset-health"><div class="approval-head"><div><p class="section-kicker">railmind-legacy-v1</p><h3>${tx('assetHealthTitle')}</h3><small>${tx('assetHealthCopy')}</small></div><button type="button" class="approval-action" id="run-asset-health">✦ ${tx('runAssetHealth')}</button></div><div id="asset-health-result"></div></section>`;
  $('#run-asset-health').addEventListener('click', runAssetHealth);
}

async function runAssetHealth() {
  if (!can('agent.run:asset')) { toast(tx('signInFirst')); return; }
  const box = $('#asset-health-result');
  box.innerHTML = `<p class="approval-record">${tx('working')}</p>`;
  const health = await api('/api/agent/run', { capability: 'asset-health', goal: 'Assess asset health', riskClass: 'operational', actionMode: 'analyse' });
  const risk = await api('/api/agent/run', { capability: 'failure-risk', goal: 'Rank failure risk', riskClass: 'operational', actionMode: 'analyse' });
  if (health.status !== 200 || risk.status !== 200) { box.innerHTML = `<div class="agent-plan agent-plan--blocked"><b>${tx('blocked')}</b><span dir="ltr">${health.json.reason ?? health.json.error ?? ''} ${risk.json.reason ?? risk.json.error ?? ''}</span></div>`; return; }
  const summary = health.json.output.value.summary;
  const byAsset = new Map(risk.json.output.value.assessments.map((a) => [a.assetId, a]));
  const cards = health.json.output.value.assets.map((a) => {
    const r = byAsset.get(a.id);
    const drivers = (r?.drivers ?? []).slice(0, 3).map((d) => `<li><span>${d.name}</span><i style="width:${Math.round(d.contribution * 100)}%"></i><small>${Math.round(d.contribution * 100)}% · ${d.detail}</small></li>`).join('');
    const rec = r?.recommendation;
    return `<article class="asset-card asset-card--${a.healthBand}"><div class="asset-card__head"><b dir="ltr">${a.id}</b><span>${status(a.healthBand === 'healthy' ? 'good' : a.healthBand === 'watch' ? 'watch' : 'critical')}</span></div><div class="asset-card__metrics"><span><small>${isAr() ? 'مؤشر الصحة' : 'Health index'}</small><b>${a.healthIndex}<i>/100</i></b></span><span><small>${isAr() ? 'اتجاه 90 يوماً' : '90-day trend'}</small><b>${a.trend90d > 0 ? '+' : ''}${a.trend90d}</b></span><span><small>${isAr() ? 'درجة المخاطر' : 'Risk score'}</small><b>${a.riskScore}<i>/100</i></b></span><span><small>${isAr() ? 'نطاق المخاطر' : 'Risk band'}</small><b>${tx('riskBandLabel')[a.riskBand]}</b></span></div><div class="asset-card__drivers"><small>${tx('drivers')}</small><ul>${drivers || `<li><small>${isAr() ? 'لا محركات مخاطر' : 'No risk drivers'}</small></li>`}</ul></div>${rec ? `<div class="asset-card__rec ${rec.requiresEngineerReview ? 'asset-card__rec--gated' : ''}"><b>${tx('actionLabel')[rec.action]} · ${tx('withinHours')} ${rec.withinHours}${tx('hours')} · ${Math.round(rec.confidence * 100)}%</b><small>${rec.summary}</small>${rec.requiresEngineerReview ? `<em>✓ ${tx('engineerReview')}</em>` : ''}</div>` : ''}</article>`;
  }).join('');
  box.innerHTML = `<div class="mini-stats asset-stats"><div><strong>${summary.total}</strong><span>${isAr() ? 'أصول' : 'Assets'}</span></div><div><strong>${summary.meanHealth ?? '—'}</strong><span>${tx('meanHealth')}</span></div><div><strong>${summary.critical}</strong><span>${tx('severity').critical}</span></div><div><strong>${summary.highRisk}</strong><span>${tx('highRiskCount')}</span></div><div><strong>${summary.awaitingReview}</strong><span>${tx('awaitingReviewCount')}</span></div></div><div class="asset-grid">${cards}</div><p class="review-note">◷ ${health.json.output.assumptions.join(' ')} · ${tx('auditRef')}: <span dir="ltr">#${health.json.auditSequences.join(', #')} · #${risk.json.auditSequences.join(', #')}</span></p>`;
}

function renderContract() {
  const ct = pack.controlTower;
  const heading = isAr() ? 'الأداء الشهري · أغسطس 2026' : 'Monthly Performance · August 2026';
  const text = isAr() ? 'يوضح هذا النموذج الأولي طبقة ذكاء مشتركة بين المالك والمقاول. يجب استبدال بنود العقد والصيغ والحدود بتعريفات معتمدة رسمياً قبل الإنتاج.' : 'This P0 demonstrates a shared intelligence layer for the owner and contractor. Contract clauses, formulas, and thresholds must be replaced with formally approved definitions before production.';
  $('#contract-content').innerHTML = `<div class="contract-grid"><div class="contract-summary"><p class="section-kicker">${pack.report.contractId}</p><h3>${heading}</h3><p>${text}</p></div><div class="mini-stats"><div><strong>${ct.kpiCount}</strong><span>KPIs</span></div><div><strong>${ct.breach}</strong><span>${isAr() ? 'خروقات' : 'Breaches'}</span></div><div><strong>${ct.attentionRequired}</strong><span>${isAr() ? 'استثناءات' : 'Exceptions'}</span></div><div><strong>${ct.criticalExceptions}</strong><span>${isAr() ? 'حرج' : 'Critical'}</span></div></div></div>${renderContractTwin()}`;
}

/* Twin table: every status and reason comes from the twin service; the browser only labels them. */
function renderContractTwin() {
  const twin = twinPack;
  if (!twin || twin.contractId !== pack.report.contractId) return `<section class="twin-panel"><p class="section-kicker">${tx('twinTitle')}</p><p>${tx('twinNone')}</p></section>`;
  const pill = (cls, label) => `<span class="status-pill status-pill--${cls}"><i>●</i>${label}</span>`;
  const obligationCls = { met: 'good', breached: 'critical', not_decision_grade: 'watch', unavailable: 'watch', not_effective: 'watch', not_evaluated: 'watch' };
  const dutyCls = { met: 'good', due: 'watch', overdue: 'critical' };
  const rows = twin.obligations.map((o) => `<div class="audit-row"><span><b>${o.title}</b><br><small>${o.description}</small></span><span dir="ltr">${o.clauseRef}</span><span>${tx('obligationKind')[o.kind] ?? o.kind} · ${tx('ownerLabel')[o.owner] ?? o.owner}</span><span>${pill(obligationCls[o.status] ?? 'watch', tx('obligationStatus')[o.status] ?? o.status)}${o.kpis.length ? `<br><small dir="ltr">${o.kpis.map((k) => `${k.kpiId}: ${k.value ?? 'n/a'} (${k.status})`).join(' · ')}</small>` : ''}</span><span><small>${o.reason}${o.consequence ? `<br>${o.consequence}` : ''}</small></span></div>`).join('');
  const duties = twin.reportingDuties.map((d) => `<div class="audit-row"><span><b>${d.title}</b><br><small dir="ltr">${d.clauseRef} · ${d.cadence}</small></span><span dir="ltr">${d.dueAt ? fmtDate(d.dueAt) : '—'}</span><span>${pill(dutyCls[d.status] ?? 'watch', tx('dutyStatus')[d.status] ?? d.status)}</span><span><small>${d.reason}</small></span></div>`).join('');
  const counts = twin.counts;
  return `<section class="twin-panel"><div class="panel-heading"><div><p class="section-kicker">${tx('twinTitle')} · <span dir="ltr">${twin.twinVersion}</span></p><h3>${twin.title}</h3><p>${tx('twinCopy')}</p></div><small class="persistence-badge">${twin.contractual ? tx('twinContractual') : tx('twinDemo')}</small></div>
    <div class="mini-stats"><div><strong>${counts.obligations}</strong><span>${tx('obligation')}</span></div><div><strong>${counts.met}</strong><span>${tx('obligationStatus').met}</span></div><div><strong>${counts.breached}</strong><span>${tx('obligationStatus').breached}</span></div><div><strong>${counts.notDecisionGrade + counts.notEvaluated}</strong><span>${tx('obligationStatus').not_evaluated}</span></div><div><strong>${counts.dutiesOverdue}</strong><span>${tx('dutyStatus').overdue}</span></div></div>
    <div class="audit-table twin-table"><div class="audit-row audit-head"><span>${tx('obligation')}</span><span>${tx('clause')}</span><span>${tx('obligationOwner')}</span><span>${tx('evaluation')}</span><span>${tx('reason')}</span></div>${rows}</div>
    <p class="section-kicker">${tx('reportingDuties')}</p><div class="audit-table twin-table twin-table--duties"><div class="audit-row audit-head"><span>${tx('reportingDuties')}</span><span>${tx('dueAt')}</span><span>${tx('evaluation')}</span><span>${tx('reason')}</span></div>${duties}</div>
    <small dir="ltr">${twin.evidence.sourceSystem}/${twin.evidence.entityId} · ${tx('asOf')} ${fmtDate(twin.evaluatedAt)}</small></section>`;
}

function reportBody() {
  const ct = pack.controlTower;
  if (isAr()) return `${ct.withinTarget} من ${ct.kpiCount} مؤشرات تجريبية ضمن المستهدف. ${ct.breach} خرق للمؤشرات، منها ${ct.criticalExceptions} حرج و${ct.highExceptions} مرتفع. هذا الملخص حتمي ولا يحتوي على حقائق مولدة من نموذج لغوي.`;
  return pack.summary;
}

function reportStatus() { return state.live.report?.status ?? pack.report.status; }
function reportGate() { return state.live.readiness ?? pack.approvalGate; }

function renderReports() {
  /* Registered packages come from /api/reports when signed in; the static preview knows only the generated pack's package. */
  const live = state.live.available && state.reports.list.length > 0;
  const cards = live
    ? state.reports.list.map((r) => ({ ...r, selected: r.reportId === state.reports.selected }))
    : [{ reportId: pack.report.reportId, cadence: pack.report.cadence, contractId: pack.report.contractId, periodEnd: pack.report.periodEnd, status: reportStatus(), selected: true }];
  const cadenceName = { monthly: tx('reportMonthly'), quarterly: tx('reportQuarterly'), annual: tx('reportAnnual') };
  const r = cards.map((c) => [cadenceName[c.cadence] ?? c.cadence, `${c.contractId} · ${c.periodEnd.slice(0, 10)}`, tx('status')[c.status] ?? c.status, c.cadence[0].toUpperCase(), c]);
  $('#report-cards').innerHTML = `<div class="report-grid">${r.map(([n, d, s, i, c]) => `<article class="report-card${c.selected ? ' report-card--selected' : ''}"><span class="report-icon">${i}</span><div><b>${n}</b><p dir="ltr">${d}</p><small>${s}${c.selected ? ` · ${tx('currentReport')}` : ''}</small></div>${c.selected ? `<button data-report type="button">${tx('details')} ↗</button>` : (live ? `<button data-select-report="${c.reportId}" type="button">${tx('selectReport')}</button>` : '')}</article>`).join('')}</div><div class="report-preview" id="report-preview"></div><section class="approval-panel" id="approval-panel"></section>`;
  $('[data-report]')?.addEventListener('click', () => { const issues = (pack.readiness?.issues ?? []).map((i) => `<li>${i.severity === 'block' ? '△' : '◷'} ${i.detail}</li>`).join(''); $('#report-preview').innerHTML = `<b>${tx('reportSummary')}</b><p>${reportBody()}</p><b>${tx('readinessTitle')}: ${tx('readiness')[pack.readiness?.state ?? 'READY']}</b>${issues ? `<ul>${issues}</ul>` : ''}<small dir="ltr">${pack.report.reportId} · ${pack.provenance.formulaVersion} · ${pack.provenance.mode}</small>`; });
  $$('[data-select-report]').forEach((button) => button.addEventListener('click', async () => { state.reports.selected = button.dataset.selectReport; await loadLive(); }));
  renderApprovalPanel();
}

function statusPillFor(status) {
  const map = { draft: 'watch', under_review: 'high', approved: 'good', rejected: 'critical', superseded: 'critical', locked: 'good' };
  return `<span class="status-pill status-pill--${map[status] ?? 'watch'}"><i>●</i>${tx('status')[status]}</span>`;
}

function renderApprovalPanel() {
  const panel = $('#approval-panel');
  if (!panel) return;
  const gate = reportGate();
  const live = state.live;
  const blockers = gate.blockers.length ? `<ul>${gate.blockers.map((b) => `<li>${b}</li>`).join('')}</ul>` : `<p>${tx('noBlockers')}</p>`;
  const permissionFor = { submit_for_review: 'report.submit', approve: 'report.approve', reject: 'report.reject', lock: 'report.lock', supersede: 'report.approve', revise: 'report.submit' };
  const actions = gate.nextTransitions.map((t) => `<button type="button" class="approval-action approval-action--${t}" data-transition="${t}" ${live.available && can(permissionFor[t]) ? '' : 'disabled'} title="${can(permissionFor[t]) ? '' : tx('permissionDenied')}">${tx('transition')[t]}</button>`).join('');
  const approval = live.report?.approval;
  const approvalLine = approval ? `<small class="approval-record" dir="auto">✓ ${approval.decision} · ${approval.reviewerId} (${tx('role')[approval.reviewerRole] ?? approval.reviewerRole}) · <span dir="ltr">${fmtDate(approval.at)}</span>${approval.note ? ` · ${approval.note}` : ''}${gate.approvalValid === undefined ? '' : ` · <b class="${gate.approvalValid ? 'ok' : 'warn'}">${gate.approvalValid ? tx('approvalValid') : tx('approvalStale')}</b>`}${approval.evidenceVersion ? ` · ${tx('evidenceVersion')} <span dir="ltr">${approval.evidenceVersion.slice(0, 12)}…</span>` : ''}</small>` : (live.report?.supersession ? `<small class="approval-record warn">△ ${live.report.supersession.reason}</small>` : '');
  const auditRows = live.audit.length ? `<div class="audit-table"><div class="audit-row audit-head">${tx('auditCols').map((c) => `<span>${c}</span>`).join('')}</div>${[...live.audit].reverse().map((e) => `<div class="audit-row audit-row--${e.action.endsWith('refused') || e.action.endsWith('blocked') ? 'refused' : 'ok'}"><span>${e.sequence}</span><span dir="ltr">${e.action}</span><span dir="ltr">${e.actorId}${e.actorRole ? ` · ${e.actorRole}` : ''}</span><span dir="ltr">${fmtDate(e.at)}</span><span dir="ltr">${e.fromState ?? '—'} → ${e.toState ?? '—'}</span><span dir="ltr" title="${e.hash}">${e.hash.slice(0, 12)}…</span></div>`).join('')}</div>` : `<p>${tx('noAudit')}</p>`;
  const chain = live.chain ? (live.chain.valid ? `<span class="chain chain--ok">✓ ${tx('chainValid')}</span>` : `<span class="chain chain--bad">△ ${tx('chainBroken')} #${live.chain.brokenAtSequence}</span>`) : '';
  const ledgerRows = (live.ledger ?? []).length ? `<div class="audit-table"><div class="audit-row audit-head">${tx('ledgerCols').map((c) => `<span>${c}</span>`).join('')}</div>${[...live.ledger].reverse().map((r) => `<div class="audit-row"><span dir="ltr">${r.ledgerId}</span><span dir="ltr">${r.kind}</span><span dir="ltr">${r.actorId}${r.actorRole ? ` · ${r.actorRole}` : ''}</span><span dir="ltr">${fmtDate(r.at)}</span><span dir="ltr">${(r.evidenceVersion ?? '—').slice(0, 12)}</span><span>${r.evidence.length}</span></div>`).join('')}</div>` : '';
  panel.innerHTML = `<section class="identity-panel" id="identity-panel"></section><div class="approval-head"><div><p class="section-kicker">${tx('approvalGate')}</p><h3>${statusPillFor(reportStatus())} <span dir="ltr">${pack.report.reportId}</span></h3>${approvalLine}</div><small class="persistence-badge">${live.available ? tx('persistence')[live.persistence] ?? live.persistence : tx('apiOffline')}</small></div>
    <div class="approval-body"><div class="approval-form"><label><span>${tx('actorId')}</span><input id="actor-id" type="text" dir="ltr" value="${state.auth.principal?.principalId ?? ''}" readonly></label><label><span>${tx('actorRole')}</span><input id="actor-role" type="text" value="${state.auth.principal ? (tx('role')[state.auth.principal.role] ?? state.auth.principal.role) : tx('notSignedIn')}" readonly></label><label class="approval-note"><span>${tx('note')}</span><input id="actor-note" type="text" placeholder="${isAr() ? 'مطلوبة عند الاعتماد مع استثناء حرج أو عند الرفض' : 'Required to approve with a critical exception, or to reject'}"></label></div>
    <div class="approval-actions">${actions || `<span class="approval-final">${tx('status')[reportStatus()]}</span>`}<button type="button" class="approval-reset" id="approval-reset" ${live.available && can('report.reset') ? '' : 'disabled'}>↻ ${tx('reset')}</button></div>
    <div class="approval-blockers"><b>${tx('blockers')}</b>${blockers}</div></div>
    <div class="approval-audit"><div class="approval-audit-head"><b>${tx('auditTrail')}</b>${chain}</div>${auditRows}</div>${ledgerRows ? `<div class="approval-audit"><div class="approval-audit-head"><b>${tx('ledgerTitle')}</b></div>${ledgerRows}</div>` : ''}`;
  renderIdentity();
  $$('[data-transition]').forEach((b) => b.addEventListener('click', () => runTransition(b.dataset.transition)));
  $('#approval-reset')?.addEventListener('click', resetReport);
}

/* ---------- Local decision API ---------- */

async function api(path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.auth.token) headers.Authorization = `Bearer ${state.auth.token}`;
  const response = await fetch(path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined });
  const json = await response.json();
  if (response.status === 401 && state.auth.token) { setToken(null); renderIdentity(); }
  if (response.status === 403 && json?.error) toast(`${tx('permissionDenied')}: ${json.error}`);
  return { status: response.status, json };
}

/* ---------- Authentication ---------- */

function setToken(token) {
  state.auth.token = token;
  try { if (token) sessionStorage.setItem('railmind.token', token); else sessionStorage.removeItem('railmind.token'); } catch { /* storage unavailable */ }
  if (!token) { state.auth.principal = null; state.auth.permissions = []; }
}

function can(permission) { return state.auth.permissions.includes(permission); }

async function loadIdentity() {
  try {
    const health = await api('/api/health');
    state.auth.mode = health.json.auth ?? null;
    if (state.auth.mode === 'demo') { const list = await api('/api/auth/demo-identities'); state.auth.identities = list.json.identities ?? []; }
    try { state.auth.token = sessionStorage.getItem('railmind.token'); } catch { /* storage unavailable */ }
    if (state.auth.token) {
      const me = await api('/api/auth/me');
      if (me.status === 200) { state.auth.principal = me.json.principal; state.auth.permissions = me.json.permissions; } else setToken(null);
    }
  } catch { state.auth.mode = null; }
  renderIdentity();
}

async function signIn(token) {
  setToken(token);
  const me = await api('/api/auth/me');
  if (me.status !== 200) { setToken(null); renderIdentity(); toast(tx('signInFailed')); return; }
  state.auth.principal = me.json.principal; state.auth.permissions = me.json.permissions;
  toast(tx('signedIn'));
  renderIdentity();
  renderPredictiveAlerts();
  await loadLive();
}

function signOut() { setToken(null); toast(tx('signedOut')); renderIdentity(); state.live = { ...state.live, available: false }; state.predictive = { loadedAt: null, assessments: null, runRef: null }; pack = DEMO_PACK; dataSource = 'static'; state.telemetry.index = pack.timeline.length - 1; renderAll(); renderTelemetry(); }

function renderIdentity() {
  const p = state.auth.principal;
  const name = $('.user-card b'); const role = $('.user-card small');
  if (name && role) {
    name.textContent = p ? p.displayName : (isAr() ? 'زائر' : 'Guest');
    role.textContent = p ? (tx('role')[p.role] ?? p.role) : tx('notSignedIn');
  }
  const panel = $('#identity-panel');
  if (!panel) return;
  if (!state.auth.mode) { panel.innerHTML = `<small>${tx('apiOffline')}</small>`; return; }
  const modeLine = `<small class="auth-mode">${state.auth.mode === 'demo' ? tx('authDemo') : tx('authToken')}</small>`;
  if (p) {
    panel.innerHTML = `<div class="identity-row"><span class="avatar">${p.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</span><div><b>${tx('signedInAs')} ${p.displayName}</b><small dir="ltr">${p.principalId} · ${tx('role')[p.role] ?? p.role}</small></div><button type="button" id="sign-out" class="approval-reset">${tx('signOut')}</button></div>${modeLine}`;
    $('#sign-out').addEventListener('click', signOut);
    return;
  }
  const chooser = state.auth.mode === 'demo'
    ? `<p>${tx('chooseIdentity')}</p><div class="identity-choices">${state.auth.identities.map((i) => `<button type="button" data-token="${i.token}"><b>${i.displayName}</b><small>${tx('role')[i.role] ?? i.role}</small></button>`).join('')}</div>`
    : `<label class="identity-token"><span>${tx('tokenLabel')}</span><input id="token-input" type="password" dir="ltr" placeholder="${tx('tokenPlaceholder')}"><button type="button" id="token-submit" class="approval-action">${tx('signIn')}</button></label>`;
  panel.innerHTML = `<b>${tx('signIn')}</b>${chooser}${modeLine}`;
  $$('[data-token]').forEach((b) => b.addEventListener('click', () => signIn(b.dataset.token)));
  $('#token-submit')?.addEventListener('click', () => signIn($('#token-input').value.trim()));
  $('#token-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') signIn(e.target.value.trim()); });
}

async function loadLive() {
  if (!state.auth.token) { state.live = { ...state.live, available: false }; renderReports(); return; }
  try {
    const registry = await api('/api/reports');
    if (registry.status === 200 && Array.isArray(registry.json.reports)) {
      state.reports.list = registry.json.reports;
      if (!state.reports.list.some((r) => r.reportId === state.reports.selected)) state.reports.selected = state.reports.list.find((r) => r.isDefault)?.reportId ?? state.reports.list[0]?.reportId ?? null;
    }
    const q = state.reports.selected ? `?reportId=${encodeURIComponent(state.reports.selected)}` : '';
    const report = await api(`/api/report${q}`);
    const audit = await api('/api/audit');
    state.live = { available: true, report: report.json.report, readiness: report.json.readiness, audit: report.json.audit, ledger: report.json.ledger ?? [], chain: audit.json.chain, persistence: report.json.persistence };
    const tower = await api(`/api/control-tower${q}`);
    if (tower.status === 200 && Array.isArray(tower.json.kpis)) {
      pack = tower.json;
      dataSource = 'live';
      const gis = await api(`/api/gis${q}`);
      if (gis.status === 200 && Array.isArray(gis.json.nodes)) gisPack = gis.json;
      const twin = await api(`/api/contract-twin${q}`);
      twinPack = twin.status === 200 && Array.isArray(twin.json.obligations) ? twin.json : null;
      state.telemetry.index = pack.timeline.length - 1;
      renderAll();
      renderTelemetry();
      return;
    }
  } catch {
    state.live = { ...state.live, available: false };
  }
  renderReports();
}

function identityPayload() {
  return { note: $('#actor-note')?.value.trim() || undefined, reportId: state.reports.selected || undefined };
}

async function runTransition(type) {
  if (!state.live.available) { toast(state.auth.token ? tx('apiOffline') : tx('notSignedIn')); return; }
  try {
    const result = await api('/api/report/transition', { type, ...identityPayload() });
    toast(result.json.ok ? tx('transitionDone') : `${tx('transitionRefused')}: ${(result.json.blockers ?? [result.json.error]).join(' ')}`);
    await loadLive();
    if (!result.json.ok && result.json.blockers?.length) { const box = $('.approval-blockers'); if (box) box.innerHTML = `<b>${tx('blockers')}</b><ul>${result.json.blockers.map((b) => `<li>${b}</li>`).join('')}</ul>`; }
  } catch { toast(tx('apiOffline')); }
}

async function resetReport() {
  if (!state.live.available) return;
  try { await api('/api/report/reset', identityPayload()); toast(tx('resetDone')); await loadLive(); } catch { toast(tx('apiOffline')); }
}

/* Question chips map to catalog capabilities. Risk class is escalated server-side to the capability minimum. */
const questionTasks = {
  attention: { capability: 'exception-analysis', actionMode: 'analyse', riskClass: 'operational' },
  evidence: { capability: 'data-quality', actionMode: 'analyse', riskClass: 'routine' },
  breaches: { capability: 'maintenance-kpi', actionMode: 'analyse', riskClass: 'operational' },
  report: { capability: 'monthly-report', actionMode: 'draft', riskClass: 'contractual' },
  briefing: { capability: 'executive-briefing', actionMode: 'draft', riskClass: 'contractual' },
};

function renderRunValue(capability, value) {
  if (!value || typeof value !== 'object') return '';
  if (Array.isArray(value.kpis)) return `<div class="run-table">${value.kpis.map((k) => `<span dir="ltr"><b>${k.id}</b> ${k.value} ${k.unit} · ${k.status}</span>`).join('')}</div>`;
  if (Array.isArray(value.exceptions)) return `<div class="run-table">${value.exceptions.map((x) => `<span>${status(x.severity)} ${x.title}</span>`).join('') || `<span>${isAr() ? 'لا استثناءات' : 'No exceptions'}</span>`}</div>`;
  if (Array.isArray(value.findings)) return `<div class="run-table"><span><b>${value.recordsChecked}</b> ${isAr() ? 'سجل مفحوص' : 'records checked'} · ${value.provisional ? (isAr() ? 'مؤقت' : 'provisional') : (isAr() ? 'صالح للاستخدام' : 'usable')}</span>${value.findings.map((f) => `<span dir="ltr">${f.severity} · ${f.code} · ${f.workOrderId ?? '—'}</span>`).join('')}</div>`;
  if (Array.isArray(value.decisions)) return `<div class="run-table"><span><b>${value.headline}</b></span>${value.decisions.map((d) => `<span>${status(d.severity)} ${d.title} → <span dir="ltr">${d.owner}</span></span>`).join('')}</div>`;
  if (value.narrative) return `<div class="run-table"><span><b>${value.report.reportId}</b> · ${value.narrativeSource}</span><span>${value.narrative}</span></div>`;
  return `<pre dir="ltr" class="run-raw">${JSON.stringify(value, null, 1).slice(0, 600)}</pre>`;
}

async function auditedAgentRun(kind, goal, target) {
  const spec = questionTasks[kind] ?? { capability: 'maintenance-kpi', actionMode: 'analyse', riskClass: 'operational' };
  if (!state.live.available) return;
  try {
    const result = await api('/api/agent/run', { ...spec, goal });
    const box = $(target);
    if (!box) return;
    const r = result.json;
    const head = `<b>${tx('agentPlan')} · ${tx('runStatus')[r.status] ?? r.status}</b><span dir="ltr">${r.agentId ?? '—'} · ${spec.capability} · ${spec.actionMode}</span>`;
    if (r.status !== 'completed') {
      box.insertAdjacentHTML('beforeend', `<div class="agent-plan agent-plan--blocked">${head}<span>${tx('runReason')}: <span dir="ltr">${r.reason ?? r.error ?? ''}</span></span><span>${tx('auditRef')}: <span dir="ltr">#${(r.auditSequences ?? []).join(', #') || '—'}</span></span></div>`);
      toast(tx('blocked'));
      return;
    }
    const o = r.output;
    box.insertAdjacentHTML('beforeend', `<div class="agent-plan">${head}<span>${tx('runTools')}: <span dir="ltr">${r.toolCalls.map((c) => c.toolId).join(', ') || '—'}</span></span><span>${tx('runModel')}: ${r.modelUsed ? tx('runModelYes') : tx('runModelNo')}</span><span>${tx('policy')}: ${r.releaseReady ? `<b class="ok">${tx('releaseReady')}</b>` : `<b class="warn">${tx('awaitingApproval')}</b>`}</span><span>${tx('runOutput')} · ${o.evidence.length} ${tx('runEvidence')}</span>${renderRunValue(spec.capability, o.value)}<span>${tx('runAssumptions')}: ${o.assumptions.join(' ')}</span><span>${tx('auditRef')}: <span dir="ltr">#${r.auditSequences.join(', #')}</span></span></div>`);
    toast(tx('planned'));
  } catch { /* static preview: deterministic answer only */ }
}

function renderAgents() {
  $('#agent-list').innerHTML = pack.agents.map((a) => {
    const meta = agentLabels[a.id] ?? { ar: a.name, arDetail: '', enDetail: '' };
    const name = isAr() ? meta.ar : a.name;
    const stateLabel = a.id === 'reporting' ? tx('humanGate') : a.mayUseModel ? tx('modelModes') : tx('deterministicModes');
    return `<div class="agent-row"><span>AI</span><div><b>${name}</b><small>${pick(meta, 'Detail')} · <span dir="ltr">${a.allowedActionModes.join(' / ')}</span></small></div><i>${stateLabel}</i></div>`;
  }).join('');
}

/* ---------- Grounded answers composed from pack numbers ---------- */

function answerText(kind) {
  const ct = pack.controlTower;
  const breaches = pack.kpis.filter((k) => k.status === 'breach');
  const breachList = breaches.map((k) => `${kpiName(k.id)} ${fmtValue(k.id, k.value)}${unit(k.unit)} ${isAr() ? 'مقابل' : 'versus'} ${targetText(k)}`).join(isAr() ? '، و' : ', and ');
  const open = openWorkOrders();
  if (kind === 'attention') {
    return isAr()
      ? `يتطلب ${ct.attentionRequired} استثناء الانتباه: ${pack.exceptions.map((x) => exceptionCopy(x).title).join('، و')}. يوجد ${open} أوامر عمل مفتوحة. كل النتائج مرتبطة بسجلات Maximo اصطناعية ومحسوبة بمحرك KPI الحتمي.`
      : `${ct.attentionRequired} exception(s) require attention: ${pack.exceptions.map((x) => x.title).join(', and ')}. ${open} work orders remain open. Every result is linked to synthetic Maximo records and computed by the deterministic KPI engine.`;
  }
  if (kind === 'evidence') {
    const total = pack.kpis.reduce((sum, k) => sum + k.evidence.length, 0);
    return isAr()
      ? `كل مؤشر من المؤشرات ${pack.kpis.length} يحمل ${pack.kpis[0].evidence.length} سجلات مصدر (${total} إحالة إجمالاً). بوابة الإرسال للمراجعة: ${pack.approvalGate.blockers.length ? pack.approvalGate.blockers.join(' ') : 'لا موانع'}. لا يتعامل العرض مع بيانات تشغيلية أو تعاقدية حية.`
      : `Each of the ${pack.kpis.length} KPIs carries ${pack.kpis[0].evidence.length} source records (${total} references in total). Submission gate: ${pack.approvalGate.blockers.length ? pack.approvalGate.blockers.join(' ') : 'no blockers'}. This interface does not handle live operational or contractual data.`;
  }
  if (kind === 'breaches') {
    return isAr() ? `يوجد ${breaches.length} خرق لمؤشرات تجريبية: ${breachList}.` : `There are ${breaches.length} demo KPI breaches: ${breachList}.`;
  }
  if (kind === 'briefing') return isAr() ? 'يُبنى الموجز التنفيذي من آخر تحليل استثناءات محكوم في ذاكرة القرار. راجع خطة التنفيذ أدناه.' : 'The executive briefing is built from the latest governed exception analysis in decision memory. See the execution plan below.';
  const gateStatus = tx('status')[reportStatus()];
  return isAr()
    ? `${reportStatus() === 'approved' || reportStatus() === 'locked' ? 'نعم' : 'لا'}. التقرير الشهري في حالة "${gateStatus}"، والانتقال التالي المسموح هو ${reportGate().nextTransitions.map((t) => tx('transition')[t]).join(' / ') || 'لا شيء'}. ${ct.criticalExceptions ? `يوجد ${ct.criticalExceptions} استثناء حرج يستلزم اعتماداً بشرياً مُسمى مع ملاحظة معالجة.` : ''}`
    : `${reportStatus() === 'approved' || reportStatus() === 'locked' ? 'Yes' : 'No'}. The monthly report is "${gateStatus}"; the next allowed transition is ${reportGate().nextTransitions.map((t) => tx('transition')[t]).join(' / ') || 'none'}. ${ct.criticalExceptions ? `${ct.criticalExceptions} critical exception(s) require a named human approval with a mitigation note.` : ''}`;
}

const footer = () => (isAr() ? 'لا يتم نشر أي قرار عالي الأثر قبل اعتماد بشري مُسمى.' : 'No high-impact decision is released before named human approval.');

function answer(kind, target = '#query-output') {
  const o = $(target);
  if (o) o.innerHTML = `<b>${tx('analysisReady')}</b><p>${answerText(kind)}</p><small>✓ ${footer()}</small>`;
}

/* Availability trend drawn from the engine's period replay, not a decorative path. */
function renderPulse() {
  const wrap = $('.chart-wrap');
  if (!wrap) return;
  const points = pack.timeline.map((snapshot) => snapshot.kpis.find((k) => k.id === 'availability').value);
  const threshold = pack.kpis.find((k) => k.id === 'availability').threshold ?? 100;
  const min = Math.min(...points, threshold) - 0.5;
  const max = Math.max(...points, threshold) + 0.3;
  const x = (i) => (points.length === 1 ? 360 : (i / (points.length - 1)) * 720);
  const y = (v) => 200 - ((v - min) / (max - min)) * 170;
  const line = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L720 220 L0 220 Z`;
  const nodes = points.map((v, i) => `<circle class="chart-node${v < threshold ? ' watch' : ''}" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${i === points.length - 1 ? 6 : 4.5}"><title>${pack.timeline[i].trigger}: ${v}%</title></circle>`).join('');
  const ty = y(threshold).toFixed(1);
  wrap.innerHTML = `<svg viewBox="0 0 720 220" role="img" aria-label="Availability replay"><defs><linearGradient id="rail-fill" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#0e5ba8" stop-opacity=".22"/><stop offset="1" stop-color="#0e5ba8" stop-opacity="0"/></linearGradient></defs><g class="chart-grid"><line x1="0" y1="30" x2="720" y2="30"/><line x1="0" y1="85" x2="720" y2="85"/><line x1="0" y1="140" x2="720" y2="140"/><line x1="0" y1="195" x2="720" y2="195"/></g><line x1="0" y1="${ty}" x2="720" y2="${ty}" stroke="#b9730d" stroke-dasharray="6 6" stroke-width="1.5"/><text x="6" y="${(Number(ty) - 6).toFixed(1)}" font-size="11" fill="#b9730d">${tx('target')} ${threshold}%</text><path class="chart-area" d="${area}"/><path class="chart-line" d="${line}"/>${nodes}</svg><div class="chart-axis">${pack.timeline.map((snapshot) => `<span dir="ltr">${snapshot.trigger === 'PERIOD-CLOSE' ? tx('periodClose') : snapshot.trigger.replace('WO-', '')}</span>`).join('')}</div>`;
  const text = $('[data-i18n="performanceText"]');
  const below = points.filter((v) => v < threshold).length;
  if (text) text.textContent = isAr() ? `مسار التوافر عبر ${points.length} إعادة حساب حتمية للفترة؛ ${below} منها أقل من الحد التجريبي.` : `Availability across ${points.length} deterministic period recomputations; ${below} fall below the demo threshold.`;
}

/* Evidence chain rendered from the highest-severity exception in the pack. */
function renderEvidenceChain() {
  const items = $$('.evidence-flow li small');
  if (items.length < 3) return;
  const top = [...pack.exceptions].sort((a, b) => ['critical', 'high', 'watch'].indexOf(a.severity) - ['critical', 'high', 'watch'].indexOf(b.severity))[0];
  const k = pack.kpis.find((item) => item.id === (top?.kpiId ?? 'availability'));
  const first = (top?.evidence ?? k.evidence)[0];
  items[0].textContent = first ? `${first.sourceSystem === 'maximo' ? 'Maximo Demo' : first.sourceSystem} · ${first.entityId}` : '—';
  items[0].setAttribute('dir', 'ltr');
  items[1].textContent = `${kpiName(k.id)} · ${k.formulaVersion}`;
  items[2].textContent = isAr() ? 'قيد مراجعة بشرية' : en.awaitingReview;
}

/* ---------- Predictive maintenance signals (API-sourced) ---------- */

const predictiveCopy = {
  ar: { kicker: 'صيانة استباقية · وكيل ذكاء الأصول', title: 'إشارات الصيانة الاستباقية', description: 'درجات مخاطر حتمية يحسبها وكيل مخاطر الأعطال في الخادم من منافذ الحالة وMaximo، وتُسجَّل في سجل التدقيق. لا يحسب المتصفح أي درجة، ولا تمثل تشخيصاً أو إنذاراً حياً.', count: 'أصول تتطلب مراجعة', model: 'railmind-legacy-v1', stream: 'مصدر الدرجات', boundary: '⌑ إشارات للقراءة والمراجعة فقط. لا يتم إنشاء أمر عمل أو تنفيذ أي إجراء تشغيلي تلقائياً. الأوزان تجريبية غير معايرة.', score: 'درجة المخاطر', driver: 'المحرك الرئيسي', route: 'افتح في الخريطة', source: 'مرجع التدقيق', review: 'مراجعة مهندس مُسمى', action: 'إجراء مقترح', load: 'حمّل الإشارات من وكيل مخاطر الأعطال', signInHint: 'سجّل الدخول بدور مهندس أو أعلى لتحميل الإشارات من الخادم.', empty: 'لم تُحمَّل إشارات بعد.', status: { critical: 'حرج', high: 'مرتفع', watch: 'متابعة', good: 'مستقر' } },
  en: { kicker: 'PREDICTIVE MAINTENANCE · ASSET INTELLIGENCE AGENT', title: 'Predictive maintenance signals', description: 'Deterministic risk scores computed server-side by the failure-risk agent from condition and Maximo ports and recorded in the audit trail. The browser scores nothing; this is not a live diagnosis or alarm.', count: 'assets need review', model: 'railmind-legacy-v1', stream: 'Score source', boundary: '⌑ Read and review only. No work order is created and no operational action is executed automatically. Weights are uncalibrated demo values.', score: 'Risk score', driver: 'Main driver', route: 'Open in map', source: 'Audit reference', review: 'Named engineer review', action: 'Proposed action', load: 'Load signals from the failure-risk agent', signInHint: 'Sign in as engineer or above to load signals from the server.', empty: 'No signals loaded yet.', status: { critical: 'Critical', high: 'High', watch: 'Watch', good: 'Stable' } },
};
const gisNodeForAsset = (assetId) => (gisPack.nodes.find((n) => n.kind === 'asset' && n.refs?.assetIds?.[0] === assetId)?.nodeId ?? null);
const actionLabels = { ar: { inspect: 'فحص', schedule_pm: 'جدولة صيانة وقائية', replace_component: 'استبدال مكوّن', monitor: 'مراقبة' }, en: { inspect: 'Inspect', schedule_pm: 'Schedule PM', replace_component: 'Replace component', monitor: 'Monitor' } };

async function loadPredictiveAlerts() {
  if (!can('agent.run:asset')) { toast(tx('signInFirst')); return; }
  const result = await api('/api/agent/run', { capability: 'failure-risk', goal: 'Predictive maintenance signals', riskClass: 'operational', actionMode: 'analyse' });
  if (result.status !== 200) { toast(tx('blocked')); return; }
  state.predictive = { loadedAt: result.json.completedAt, assessments: result.json.output.value.assessments, runRef: `#${result.json.auditSequences.join(', #')}` };
  renderPredictiveAlerts();
}

function renderPredictiveAlerts() {
  const root = $('#predictive-alert-list');
  if (!root) return;
  const copy = predictiveCopy[state.language];
  const list = state.predictive.assessments ?? [];
  const severityOf = (band) => (band === 'high' ? 'critical' : band === 'medium' ? 'high' : 'good');
  const attention = list.filter((a) => a.riskBand !== 'low').length;
  $('#predictive-kicker').textContent = copy.kicker;
  $('#predictive-title').textContent = copy.title;
  $('#predictive-description').textContent = copy.description;
  $('#predictive-count').textContent = String(attention).padStart(2, '0');
  $('#predictive-count-label').textContent = copy.count;
  $('#predictive-model-state').textContent = copy.model;
  $('#predictive-stream-label').textContent = copy.stream;
  $('#predictive-stream-detail').textContent = state.predictive.runRef ? `${copy.source} ${state.predictive.runRef}` : '—';
  $('#predictive-boundary').textContent = copy.boundary;
  if (!list.length) {
    root.innerHTML = `<div class="predictive-empty"><p>${state.auth.principal ? copy.empty : copy.signInHint}</p><button type="button" class="approval-action" id="predictive-load" ${can('agent.run:asset') ? '' : 'disabled'}>✦ ${copy.load}</button></div>`;
    $('#predictive-load')?.addEventListener('click', loadPredictiveAlerts);
    return;
  }
  root.innerHTML = list.map((a) => { const severity = severityOf(a.riskBand); const top = a.drivers[0]; const node = gisNodeForAsset(a.assetId); return `<article class="predictive-alert predictive-alert--${severity}" data-predictive-alert="${a.assetId}"><div class="predictive-alert__head"><span class="predictive-alert__icon">✦</span><div><div class="predictive-alert__title"><b dir="ltr">${a.assetId}</b><span class="predictive-alert__status">${copy.status[severity]}</span></div><small>${a.name}</small></div><div class="predictive-alert__score"><strong>${a.riskScore}<small>/100</small></strong><span>${copy.score}</span></div></div><div class="predictive-alert__details"><div><small>${copy.driver}</small><b>${top ? `${top.name} · ${Math.round(top.contribution * 100)}%` : '—'}</b></div><div><small>${copy.action}</small><b>${actionLabels[state.language][a.recommendation.action]} · ${a.recommendation.withinHours}h${a.recommendation.requiresEngineerReview ? ` · ${copy.review}` : ''}</b></div></div><div class="predictive-alert__footer"><span>⌁ <small>${copy.source}</small> <b dir="ltr">${state.predictive.runRef}</b></span>${node ? `<button type="button" data-predictive-node="${node}">${copy.route} <i>↗</i></button>` : ''}</div></article>`; }).join('') + `<div class="predictive-empty"><button type="button" class="approval-reset" id="predictive-load">↻ ${copy.load}</button></div>`;
  $$('[data-predictive-node]').forEach((button) => button.addEventListener('click', () => { switchView('network'); openGisInspector(button.dataset.predictiveNode); window.setTimeout(() => $('#gis-inspector')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 120); }));
  $('#predictive-load')?.addEventListener('click', loadPredictiveAlerts);
}

/* ---------- GIS ---------- */

const gisCopy = {
  ar: { kicker: 'نموذج GIS تشغيلي', title: 'خريطة شبكة الخط الأحمر', description: 'اعرض طبقات الأصول والأعطال وأوامر العمل في سياق شبكي توضيحي. جميع المواقع والحالات اصطناعية ومحلية.', boundaryTitle: 'محاكاة محلية', boundaryCopy: 'لا توجد إحداثيات أو بيانات تشغيلية حية', layersTitle: 'طبقات الخريطة', layersCopy: 'اختر ما يظهر في مساحة العمل', assets: 'الأصول', faults: 'الأعطال', workorders: 'أوامر العمل', trains: 'حركة القطارات', trainsCount: '3 قطارات محاكاة محلية', trainHudTitle: 'حركة قطارات محاكاة محلية', trainHudCopy: '3 رحلات توضيحية على الخط الأحمر', train: 'قطار', filter: 'تصفية الحالة', clear: 'مسح', all: 'الكل', critical: 'حرج', watch: 'متابعة', stable: 'مستقر', streamTitle: 'متزامن مع المحاكاة', streamCopy: 'تُحدّث الحالات عند وصول إشارة TLM', mapMode: 'عرض تشغيلي', mapScope: 'نطاق تجريبي · الخط الأحمر', centre: 'المركز المالي', museum: 'منطقة المتحف', marina: 'المارينا', terminal: 'المحطة الطرفية', atc: 'تحكم آلي · متابعة', signal: 'إشارات · مستقر', fault: 'تنبيه MTTR', woOne: 'مفتوح · PM', woTwo: 'مجدول', captionTitle: 'محاكاة شبكة حضرية', captionCopy: 'لا تمثل الموقع أو الأبعاد أو مسار دبي مترو الفعلي.', inspectorTitle: 'مستكشف الشبكة', inspectorCopy: 'اختر محطة أو رمزاً على الخريطة لمراجعة الحالة والأدلة وارتباط القرار.', evidence: 'مسار الدليل', decision: 'عرض حزمة القرار ↗', statusTitle: 'الشبكة مستقرة ضمن نطاق العرض التجريبي', station: 'محطة', asset: 'أصل', faultType: 'تنبيه عطل', workorder: 'أمر عمل', statusStable: 'مستقر', statusWatch: 'متابعة', statusCritical: 'حرج', telemetry: 'آخر إشارة توضيحية' },
  en: { kicker: 'OPERATIONAL GIS MODEL', title: 'Red Line network map', description: 'Review asset, fault, and work-order layers in an illustrative network context. All positions and states are synthetic and local.', boundaryTitle: 'Local simulation', boundaryCopy: 'No live coordinates or operational data', layersTitle: 'Map layers', layersCopy: 'Choose what is visible in the workspace', assets: 'Assets', faults: 'Faults', workorders: 'Work orders', trains: 'Train movement', trainsCount: '3 locally simulated trains', trainHudTitle: 'Local simulated train movement', trainHudCopy: '3 illustrative services on the Red Line', train: 'Train', filter: 'Filter by state', clear: 'Clear', all: 'All', critical: 'Critical', watch: 'Watch', stable: 'Stable', streamTitle: 'Synced to simulation', streamCopy: 'States update when a TLM signal arrives', mapMode: 'Operational view', mapScope: 'Pilot scope · Red Line', centre: 'Financial Centre', museum: 'Museum District', marina: 'Marina', terminal: 'Terminal', atc: 'ATC · Watch', signal: 'Signalling · Stable', fault: 'MTTR alert', woOne: 'Open · PM', woTwo: 'Scheduled', captionTitle: 'Urban network simulation', captionCopy: 'Does not represent the location, dimensions, or actual Dubai Metro alignment.', inspectorTitle: 'Network explorer', inspectorCopy: 'Select a station or symbol to review state, evidence, and decision linkage.', evidence: 'Evidence trail', decision: 'Open decision pack ↗', statusTitle: 'Network stable within the illustrative scope', station: 'Station', asset: 'Asset', faultType: 'Fault alert', workorder: 'Work order', statusStable: 'Stable', statusWatch: 'Watch', statusCritical: 'Critical', telemetry: 'Latest illustrative signal' },
};

const mttrText = () => { const k = pack.kpis.find((item) => item.id === 'mttr'); return `MTTR ${fmtValue('mttr', k.value)}${unit(k.unit)}`; };
const assetFacts = (id) => pack.assets.find((a) => a.assetId === id);

/* Bilingual labels for GIS node kinds and joined facts. Values come from the GIS pack; nothing here is a fact. */
const gisKindKey = { station: 'station', asset: 'asset', exception: 'faultType', 'work-order': 'workorder', train: 'train' };
const gisFactCopy = {
  ar: { assetStatus: 'حالة الأصل', openWorkOrders: 'أوامر عمل مفتوحة', failureWorkOrders: 'أعطال الفترة', downtimeMinutes: 'دقائق التوقف', workType: 'نوع العمل', workOrderStatus: 'حالة أمر العمل', severity: 'الشدة', kpi: 'قاعدة المؤشر', kpiStatus: 'حالة المؤشر', linkedAssets: 'أصول مرتبطة', simulated: 'محاكاة عرض', none: 'لا يوجد', noEvidence: 'لا توجد سجلات مصدر في الفترة', schematicNote: 'مخطط عرض اصطناعي: المواقع نسب على لوحة العرض وليست إحداثيات، وأسماء المحطات توضيحية. الحقائق مضمومة من حزمة برج التحكم.', trainNote: 'حركة قطار محاكاة للعرض فقط. لا تمثل موقعاً أو رحلة فعلية.', source: 'المصدر', joinedFrom: 'الحقائق مضمومة من' },
  en: { assetStatus: 'Asset state', openWorkOrders: 'Open work orders', failureWorkOrders: 'Period failures', downtimeMinutes: 'Downtime minutes', workType: 'Work type', workOrderStatus: 'Work order status', severity: 'Severity', kpi: 'KPI rule', kpiStatus: 'KPI status', linkedAssets: 'Linked assets', simulated: 'Presentation simulation', none: 'None', noEvidence: 'No source records in the period', schematicNote: 'Synthetic presentation schematic: positions are canvas percentages, not coordinates, and station names are illustrative. Facts are joined from the Control Tower pack.', trainNote: 'Simulated train movement for presentation only. It is not a live position or service.', source: 'Source', joinedFrom: 'Facts joined from' },
};
const gisStatusLabel = (status) => gisCopy[state.language][`status${status[0].toUpperCase()}${status.slice(1)}`];
const gisFactValue = (fact) => {
  const copy = gisFactCopy[state.language];
  if (fact.key === 'assetStatus') return gisStatusLabel(fact.value);
  if (fact.key === 'simulated') return copy.simulated;
  if (fact.key === 'severity') return fact.value === 'none' ? copy.none : (tx('severity')[fact.value] ?? fact.value);
  return String(fact.value);
};

/* Markers are rendered from the GIS pack. Train markers stay in the markup because their movement is a CSS animation. */
function renderGisNodes() {
  const root = $('#gis-nodes');
  if (!root) return;
  const copy = gisCopy[state.language];
  const markup = gisPack.nodes.filter((node) => node.kind !== 'train').map((node) => {
    const pos = `style="top:${node.position.y}%;left:${node.position.x}%"`;
    const common = `data-gis-node="${node.nodeId}" data-status="${node.status}" ${pos} tabindex="0" role="button"`;
    const name = node.label[state.language];
    if (node.kind === 'station') return `<div class="gis-station" ${common}><span class="station-core"></span><div class="station-label"><b>${name}</b><small>${node.code} · ${gisStatusLabel(node.status)}</small></div></div>`;
    if (node.kind === 'asset') return `<div class="gis-asset-marker" data-gis-item="assets" ${common}><span>⌁</span><i></i><div class="gis-marker-label"><b dir="ltr">${node.code}</b><small>${copy.asset} · ${gisStatusLabel(node.status)}</small></div></div>`;
    if (node.kind === 'exception') return `<div class="gis-fault-marker" data-gis-item="faults" ${common}><span>△</span><i></i><div class="gis-marker-label"><b>${name}</b><small dir="ltr">${node.exceptionId ?? node.code}</small></div></div>`;
    const status = node.facts.find((f) => f.key === 'workOrderStatus')?.value ?? '';
    const workType = node.facts.find((f) => f.key === 'workType')?.value ?? '';
    return `<div class="gis-workorder-marker" data-gis-item="workorders" ${common}><span>WO</span><div class="gis-marker-label"><b dir="ltr">${node.code}</b><small dir="ltr">${status}${workType ? ` · ${workType}` : ''}</small></div></div>`;
  }).join('');
  root.innerHTML = markup;
  gisPack.nodes.filter((node) => node.kind === 'train').forEach((node) => { const marker = $(`[data-gis-node="${node.nodeId}"]`); if (marker) marker.dataset.status = node.status; });
  applyGisFilters();
}

function renderGisText() {
  if (!$('#view-network')) return;
  const copy = gisCopy[state.language];
  const values = { 'gis-kicker': 'kicker', 'gis-title': 'title', 'gis-description': 'description', 'gis-boundary-title': 'boundaryTitle', 'gis-boundary-copy': 'boundaryCopy', 'gis-layers-title': 'layersTitle', 'gis-layers-copy': 'layersCopy', 'gis-assets-label': 'assets', 'gis-faults-label': 'faults', 'gis-workorders-label': 'workorders', 'gis-trains-label': 'trains', 'gis-trains-count': 'trainsCount', 'gis-train-hud-title': 'trainHudTitle', 'gis-train-hud-copy': 'trainHudCopy', 'gis-filter-label': 'filter', 'gis-clear-filter': 'clear', 'gis-stream-title': 'streamTitle', 'gis-stream-copy': 'streamCopy', 'gis-map-mode': 'mapMode', 'gis-map-scope': 'mapScope', 'gis-caption-title': 'captionTitle', 'gis-caption-copy': 'captionCopy', 'gis-inspector-title': 'inspectorTitle', 'gis-inspector-copy': 'inspectorCopy', 'gis-evidence-label': 'evidence', 'gis-open-decision': 'decision', 'gis-status-strip-title': 'statusTitle' };
  Object.entries(values).forEach(([id, key]) => { const element = $(`#${id}`); if (element) element.textContent = copy[key]; });
  const counts = gisPack.counts;
  $('#gis-assets-count').textContent = isAr() ? `${counts.assets} أصول في العينة` : `${counts.assets} assets in sample`;
  $('#gis-faults-count').textContent = isAr() ? `${counts.criticalExceptions} استثناء حرج` : `${counts.criticalExceptions} critical exception(s)`;
  $('#gis-workorders-count').textContent = isAr() ? `${counts.openWorkOrders} أوامر عمل مفتوحة` : `${counts.openWorkOrders} open work orders`;
  const by = counts.byStatus;
  $('#gis-status-strip-copy').textContent = isAr() ? `${by.critical} حرج · ${by.watch} متابعة · ${by.stable} مستقرة · مضمومة من ${gisPack.provenance.reportId}` : `${by.critical} critical · ${by.watch} watch · ${by.stable} stable · joined from ${gisPack.provenance.reportId}`;
  $('#gis-map-scope').textContent = `${copy.mapScope} · ${gisPack.line.label[state.language]}`;
  $$('.gis-filter').forEach((button) => { button.textContent = copy[button.dataset.gisFilter]; });
  renderGisNodes();
  renderGisStream();
}

function renderGisStream() {
  if (!$('#gis-map-events')) return;
  const copy = gisCopy[state.language];
  const event = state.gis.eventLabel || (isAr() ? 'TLM-000 · جاهز' : 'TLM-000 · Ready');
  $('#gis-map-events').textContent = `${copy.telemetry}: ${event}`;
  renderTrainHud();
}

/* Train movement is a presentation-only simulation. It never represents live train positions. */
const trainSimulation = [
  { id: 'train-r01', code: 'R01', ar: 'R01 يتجه داخل المسار التوضيحي', en: 'R01 progressing on the illustrative route' },
  { id: 'train-r02', code: 'R02', ar: 'R02 في نقطة متابعة توضيحية', en: 'R02 at an illustrative watch point' },
  { id: 'train-r03', code: 'R03', ar: 'R03 يحافظ على تباعد محاكاة محلي', en: 'R03 maintaining local simulated separation' },
];

function renderTrainHud() {
  const hud = $('#gis-train-hud');
  if (!hud) return;
  const copy = gisCopy[state.language];
  const current = trainSimulation[state.gis.train.cycle % trainSimulation.length];
  $('#gis-train-hud-title').textContent = copy.trainHudTitle;
  $('#gis-train-hud-copy').textContent = state.gis.train.lastEvent || copy.trainHudCopy;
  $('#gis-train-hud-code').textContent = current.code;
  $$('.gis-train-marker').forEach((marker) => marker.classList.toggle('gis-train-marker--active', marker.dataset.gisNode === state.gis.train.active));
}

function advanceTrainSimulation() {
  const train = state.gis.train;
  train.cycle = (train.cycle + 1) % trainSimulation.length;
  const current = trainSimulation[train.cycle];
  train.active = current.id;
  train.lastEvent = `${current.code} · ${isAr() ? current.ar : current.en}`;
  renderTrainHud();
}

function applyGisFilters() {
  $$('.gis-station,.gis-asset-marker,.gis-fault-marker,.gis-workorder-marker,.gis-train-marker').forEach((item) => {
    const layer = item.dataset.gisItem;
    const visibleLayer = !layer || state.gis.layers[layer];
    const visibleState = state.gis.filter === 'all' || item.dataset.status === state.gis.filter;
    item.classList.toggle('gis-item--hidden', !(visibleLayer && visibleState));
  });
  $$('.gis-filter').forEach((button) => button.classList.toggle('is-active', button.dataset.gisFilter === state.gis.filter));
  if (state.gis.selected && $(`[data-gis-node="${state.gis.selected}"]`)?.classList.contains('gis-item--hidden')) closeGisInspector();
}

function openGisInspector(nodeId) {
  const node = gisPack.nodes.find((n) => n.nodeId === nodeId);
  if (!node) return;
  const copy = gisCopy[state.language];
  const facts = gisFactCopy[state.language];
  state.gis.selected = nodeId;
  $('#gis-inspector-idle').hidden = true;
  $('#gis-inspector-detail').hidden = false;
  $('#gis-inspector-type').textContent = copy[gisKindKey[node.kind]];
  $('#gis-inspector-status').innerHTML = `<span class="status-pill status-pill--${node.status}"><i>●</i>${gisStatusLabel(node.status)}</span>`;
  $('#gis-inspector-name').textContent = node.label[state.language];
  $('#gis-inspector-context').textContent = node.kind === 'train' ? facts.trainNote : facts.schematicNote;
  $('#gis-inspector-facts').innerHTML = node.facts.map((fact) => `<div><small>${facts[fact.key] ?? fact.key}</small><b>${gisFactValue(fact)}</b></div>`).join('');
  $('#gis-inspector-evidence').textContent = node.evidence.length ? `${facts.source}: ${[...new Set(node.evidence.map((e) => `${e.sourceSystem}/${e.entityId}`))].join(' · ')}` : facts.noEvidence;
  const decision = node.refs?.kpiId ?? '';
  $('#gis-open-decision').dataset.decision = decision;
  $('#gis-open-decision').hidden = !decision;
  $$('.gis-item--selected').forEach((item) => item.classList.remove('gis-item--selected'));
  $(`[data-gis-node="${nodeId}"]`)?.classList.add('gis-item--selected');
}

function closeGisInspector() {
  state.gis.selected = null;
  $('#gis-inspector-idle').hidden = false;
  $('#gis-inspector-detail').hidden = true;
  $$('.gis-item--selected').forEach((item) => item.classList.remove('gis-item--selected'));
}

function setGisZoom(nextZoom) {
  state.gis.zoom = Math.min(1.32, Math.max(1, nextZoom));
  $('#gis-map-viewport').style.setProperty('--gis-zoom', String(state.gis.zoom));
}

/* ---------- Telemetry: deterministic replay of the period ---------- */

function snapshotLabel(snapshot) {
  const trigger = snapshot.trigger === 'PERIOD-CLOSE' ? tx('periodClose') : snapshot.trigger;
  return `${trigger} · ${tx('asOf')} ${fmtDate(snapshot.asOf)} · ${snapshot.workOrdersSeen} ${tx('workOrdersSeen')}`;
}

function renderTelemetry() {
  const stream = state.telemetry;
  const snapshot = currentSnapshot();
  $('#telemetry-title').textContent = stream.active ? tx('telemetryTitle') : tx('telemetryPaused');
  $('#telemetry-source').textContent = `${dataSource === 'live' ? tx('sourceLive') : tx('sourceStatic')} · ${tx('readinessTitle')}: ${tx('readiness')[pack.readiness?.state ?? 'READY']}${pack.freshness?.ageHours != null ? ` · ${pack.freshness.ageHours} ${tx('ageHours')}` : ''}`;
  $('#telemetry-label').textContent = tx('telemetryLast');
  $('#telemetry-updated').textContent = stream.lastSignalAt ? `${stream.lastSignalAt} · ${snapshotLabel(snapshot)}` : (stream.active ? tx('telemetryReady') : tx('telemetryPausedAt'));
  $('#telemetry-event').textContent = `${tx('telemetryEventPrefix')}-${String(stream.eventId).padStart(3, '0')} · ${snapshot.trigger}`;
  $('#telemetry-toggle').setAttribute('aria-pressed', String(stream.active));
  $('#telemetry-toggle-icon').textContent = stream.active ? 'Ⅱ' : '▶';
  $('#telemetry-toggle-label').textContent = stream.active ? tx('telemetryStop') : tx('telemetryStart');
  $('#telemetry-dot').classList.toggle('telemetry-dot--paused', !stream.active);
  $('#telemetry-event').classList.toggle('telemetry-event--idle', !stream.active);
}

function applySnapshotToCards() {
  const snapshot = currentSnapshot();
  $$('.metric-card').forEach((card) => {
    const k = pack.kpis.find((item) => item.id === card.dataset.kpi);
    const live = snapshot.kpis.find((item) => item.id === k.id);
    const view = { ...k, value: live.value, status: live.status };
    card.className = `metric-card metric-card--${cardStatus(view)}`;
    card.querySelector('.metric-value').textContent = fmtValue(k.id, live.value);
    card.querySelector('.metric-trend').innerHTML = `<i></i>${trendText(view)}`;
    void card.offsetWidth;
    card.classList.add('metric-card--updating');
  });
}

function emitTelemetry() {
  const stream = state.telemetry;
  stream.index = (stream.index + 1) % pack.timeline.length;
  stream.eventId += 1;
  applySnapshotToCards();
  stream.lastSignalAt = new Date().toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  state.gis.eventLabel = `${tx('telemetryEventPrefix')}-${String(stream.eventId).padStart(3, '0')} · ${currentSnapshot().trigger}`;
  advanceTrainSimulation();
  renderTelemetry();
  renderGisStream();
}

function startTelemetry({ immediate = false } = {}) {
  window.clearInterval(state.telemetry.timer);
  state.telemetry.active = true;
  if (immediate) emitTelemetry();
  state.telemetry.timer = window.setInterval(() => emitTelemetry(), 3200);
  renderTelemetry();
}

function pauseTelemetry() {
  window.clearInterval(state.telemetry.timer);
  state.telemetry.timer = null;
  state.telemetry.active = false;
  renderTelemetry();
}

function resetTelemetry() {
  state.telemetry.index = pack.timeline.length - 1;
  state.telemetry.eventId = 0;
  state.telemetry.lastSignalAt = null;
  state.gis.train.cycle = 0;
  state.gis.train.active = 'train-r01';
  state.gis.train.lastEvent = null;
  renderKpis();
  renderTelemetry();
  renderGisStream();
  toast(tx('telemetryReset'));
}

/* ---------- Decision drawer (exception or KPI observation) ---------- */

function openDecision(kpiId) {
  const k = pack.kpis.find((item) => item.id === kpiId) ?? pack.kpis[0];
  const exception = pack.exceptions.find((item) => item.kpiId === (kpiId === 'readiness' ? 'readiness' : k.id));
  const evidence = exception ? exception.evidence : k.evidence;
  const observed = evidence.length ? `${fmtDate(evidence[0].observedAt)} → ${fmtDate(evidence[evidence.length - 1].observedAt)}` : '—';
  const sev = exception ? exception.severity : 'good';
  const copy = exception ? exceptionCopy(exception) : { title: kpiName(k.id), alt: k.name, decision: tx('kpiWithin') };
  $('#drawer-id').textContent = exception ? exceptionCode(exception) : k.id.toUpperCase();
  $('#drawer-content').innerHTML = `<div class="drawer-status">${status(sev)}</div><h3>${copy.title}</h3><small class="drawer-secondary">${copy.alt}</small><section class="drawer-block"><span>${kpiName(k.id)}</span><p><b dir="ltr">${fmtValue(k.id, k.value)}${unit(k.unit)}</b> · ${tx('target')} ${targetText(k)} · ${tx('formula')} <span dir="ltr">${k.formulaVersion}</span></p><small>${tx('engineLabel')}</small></section><section class="drawer-block"><span>${tx('recommendation')}</span><p>${copy.decision} ${isAr() ? 'هذا مقترح للمراجعة فقط.' : 'This is a review-only proposal.'}</p></section><section class="drawer-evidence"><div><span>⌁</span><p><small>${tx('source')}</small><b dir="ltr">${sourceLabel(evidence)}</b></p></div><div><span>◷</span><p><small>${tx('observed')}</small><b dir="ltr">${observed}</b></p></div><div><span>✓</span><p><small>${tx('quality')}</small><b>${tx('verified')} · ${evidence.length} ${tx('evidenceCount')}</b></p></div></section>${exception ? `<p class="review-note" dir="ltr">${tx('exceptionId')}: ${exception.id}</p>` : ''}<section class="governance-callout"><span>⌑</span><p><b>${tx('governance')}</b><small>${tx('noWrite')}</small></p></section><button class="review-button" id="request-review" type="button">✓ ${tx('requestReview')}</button><p class="review-note">◷ ${tx('reviewNote')}</p>`;
  $('#drawer-backdrop').hidden = false;
  document.body.classList.add('drawer-open');
  $('#request-review')?.addEventListener('click', async () => {
    if (state.live.available && reportStatus() === 'draft') { await runTransition('submit_for_review'); toast(tx('submitViaDrawer')); }
    else toast(tx('reviewReady'));
    closeDrawer();
  });
}

function closeDrawer() { $('#drawer-backdrop').hidden = true; document.body.classList.remove('drawer-open'); }
function toast(message) { const box = $('#toast'); box.textContent = message; box.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => box.classList.remove('show'), 2700); }

/* ---------- Language ---------- */

function captureArabicBaseline() {
  $$('[data-i18n]').forEach((e) => { e.dataset.arText = e.textContent; });
  $$('[data-i18n-option]').forEach((e) => { e.dataset.arText = e.textContent; });
  $$('[data-i18n-placeholder]').forEach((e) => { e.dataset.arText = e.placeholder; });
}

function applyLanguage() {
  const arabic = isAr();
  document.documentElement.lang = state.language;
  document.documentElement.dir = arabic ? 'rtl' : 'ltr';
  document.title = arabic ? 'RailMind | منصة ذكاء الأصول' : 'RailMind | Asset Intelligence Platform';
  $$('[data-i18n]').forEach((e) => { const key = e.dataset.i18n; e.textContent = arabic ? e.dataset.arText : (en[key] ?? e.dataset.arText); });
  $$('[data-i18n-option]').forEach((e) => { const key = e.dataset.i18nOption; e.textContent = arabic ? e.dataset.arText : (en[key] ?? e.dataset.arText); });
  $$('[data-i18n-placeholder]').forEach((e) => { const key = e.dataset.i18nPlaceholder; e.placeholder = arabic ? e.dataset.arText : (en[key] ?? e.dataset.arText); });
  $('#language-button b').textContent = arabic ? 'EN' : 'ع';
  renderAll();
  renderTelemetry();
  if (state.gis.selected) openGisInspector(state.gis.selected);
}

function renderAll() { renderPredictiveAlerts(); renderKpis(); renderDecisions(); renderExceptionTable(); renderAssets(); renderContract(); renderReports(); renderAgents(); renderPulse(); renderEvidenceChain(); renderGisText(); applyGisFilters(); }

function switchView(view) { $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === view)); $$('.view').forEach((s) => s.classList.toggle('active', s.id === `view-${view}`)); $('#app-shell').classList.remove('menu-open'); window.scrollTo({ top: 0, behavior: 'smooth' }); }

/* ---------- Wiring ---------- */

function setup() {
  $$('.nav-item').forEach((b) => b.addEventListener('click', () => switchView(b.dataset.view)));
  $('#language-button').addEventListener('click', () => { state.language = isAr() ? 'en' : 'ar'; applyLanguage(); });
  $('#menu-button').addEventListener('click', () => $('#app-shell').classList.toggle('menu-open'));
  $('#refresh-button').addEventListener('click', () => { $('#updated-time').textContent = new Date().toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }); toast(tx('refreshed')); });
  $('#density-button').addEventListener('click', () => { state.compact = !state.compact; $('#app-shell').classList.toggle('compact', state.compact); toast(tx(state.compact ? 'compactOn' : 'compactOff')); });
  $('#notifications').addEventListener('click', () => toast(tx('notify')));
  ['#safeguard-button', '#boundary-button', '#more-button'].forEach((s) => $(s).addEventListener('click', () => toast(tx('guardrail'))));
  $('#view-all-button').addEventListener('click', () => switchView('exceptions'));
  const topException = [...pack.exceptions].sort((a, b) => ['critical', 'high', 'watch'].indexOf(a.severity) - ['critical', 'high', 'watch'].indexOf(b.severity))[0];
  $('#open-brief-button').addEventListener('click', () => openDecision(topException?.kpiId ?? 'availability'));
  $('#evidence-button').addEventListener('click', () => openDecision('availability'));
  $('#drawer-close').addEventListener('click', closeDrawer);
  $('#drawer-backdrop').addEventListener('click', (e) => { if (e.target === $('#drawer-backdrop')) closeDrawer(); });
  $('#search-trigger').addEventListener('click', () => { switchView('agents'); setTimeout(() => $('#agent-input').focus(), 260); });
  document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); switchView('agents'); setTimeout(() => $('#agent-input').focus(), 260); } if (e.key === 'Escape') closeDrawer(); });
  $$('[data-question]').forEach((b) => b.addEventListener('click', () => { answer(b.dataset.question); answer(b.dataset.question, '#agent-answer'); $('#agent-status').classList.add('ready'); $('#agent-status b').textContent = tx('analysisReady'); auditedAgentRun(b.dataset.question, b.textContent.trim(), b.closest('#view-agents') ? '#query-output' : '#agent-answer'); }));
  $('#agent-run').addEventListener('click', () => {
    if (!$('#agent-input').value.trim()) { toast(isAr() ? 'اكتب سؤالاً أو اختر اقتراحاً أولاً.' : 'Write a question or choose a suggestion first.'); return; }
    const s = $('#agent-status'); s.classList.add('working'); s.querySelector('b').textContent = tx('working');
    const goal = $('#agent-input').value.trim();
    setTimeout(() => { s.classList.remove('working'); s.classList.add('ready'); s.querySelector('b').textContent = tx('analysisReady'); answer('attention', '#agent-answer'); auditedAgentRun('free', goal, '#agent-answer'); }, 620);
  });
}

function setupTelemetryControls() {
  $('#telemetry-toggle').addEventListener('click', () => { if (state.telemetry.active) pauseTelemetry(); else startTelemetry({ immediate: true }); });
  $('#telemetry-reset').addEventListener('click', () => resetTelemetry());
  document.addEventListener('visibilitychange', () => { if (document.hidden) window.clearInterval(state.telemetry.timer); else if (state.telemetry.active) startTelemetry(); });
}

function setupGisControls() {
  $$('[data-gis-layer]').forEach((input) => input.addEventListener('change', () => { state.gis.layers[input.dataset.gisLayer] = input.checked; applyGisFilters(); }));
  $$('.gis-filter').forEach((button) => button.addEventListener('click', () => { state.gis.filter = button.dataset.gisFilter; applyGisFilters(); }));
  $('#gis-clear-filter').addEventListener('click', () => { state.gis.filter = 'all'; $$('[data-gis-layer]').forEach((input) => { input.checked = true; state.gis.layers[input.dataset.gisLayer] = true; }); applyGisFilters(); toast(isAr() ? 'تمت استعادة جميع طبقات محاكاة GIS.' : 'All GIS simulation layers restored.'); });
  const viewport = $('#gis-map-viewport');
  viewport?.addEventListener('click', (event) => { const item = event.target.closest('[data-gis-node]'); if (item) openGisInspector(item.dataset.gisNode); });
  viewport?.addEventListener('keydown', (event) => { const item = event.target.closest('[data-gis-node]'); if (item && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openGisInspector(item.dataset.gisNode); } });
  $('#gis-close-inspector').addEventListener('click', closeGisInspector);
  $('#gis-open-decision').addEventListener('click', () => { const decision = $('#gis-open-decision').dataset.decision; if (decision) openDecision(decision); });
  $('#gis-zoom-in').addEventListener('click', () => setGisZoom(state.gis.zoom + 0.08));
  $('#gis-zoom-out').addEventListener('click', () => setGisZoom(state.gis.zoom - 0.08));
  $('#gis-fit-network').addEventListener('click', () => setGisZoom(1));
}

captureArabicBaseline();
renderAll();
renderTelemetry();
setup();
setupTelemetryControls();
setupGisControls();
startTelemetry();
loadIdentity().then(loadLive);
setTimeout(() => $('#loading-wash').classList.add('hide'), 560);
