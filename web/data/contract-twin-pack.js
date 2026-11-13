// GENERATED FILE. Do not edit by hand.
// Source: src/web/contract-twin-pack.ts via `npm run build:web-data`. Verified by `npm run check:web-data`.
// Demo contract twin (demo_only, synthetic clauses) evaluated against the Control Tower DTO.
export const CONTRACT_TWIN_PACK = {
  "contractId": "DEMO-CONTRACT",
  "twinVersion": "demo-twin-v1",
  "approvalStatus": "demo_only",
  "contractual": false,
  "title": "Demo maintenance services agreement (synthetic)",
  "parties": {
    "owner": "Demo asset owner",
    "contractor": "Demo maintenance contractor"
  },
  "term": {
    "start": "2026-01-01T00:00:00Z",
    "end": "2028-12-31T23:59:59Z"
  },
  "evaluatedAt": "2026-08-31T23:59:59Z",
  "period": {
    "start": "2026-08-01T00:00:00Z",
    "end": "2026-08-31T23:59:59Z",
    "reportId": "DEMO-2026-08",
    "cadence": "monthly"
  },
  "obligations": [
    {
      "obligationId": "OBL-AVAIL",
      "clauseRef": "Demo clause 12.1",
      "kind": "kpi",
      "title": "Service availability",
      "description": "Maintain service availability at or above the demo threshold each reporting period.",
      "owner": "contractor",
      "kpiIds": [
        "availability"
      ],
      "evidenceRules": [
        "Maximo work orders with downtime minutes",
        "Approved planned service minutes for the period"
      ],
      "consequence": "Demo service credit per breached period (synthetic).",
      "effectiveFrom": "2026-01-01T00:00:00Z",
      "status": "breached",
      "kpis": [
        {
          "kpiId": "availability",
          "value": 98.522,
          "status": "breach",
          "readiness": "PROVISIONAL",
          "decisionGrade": true
        }
      ],
      "evidence": [
        {
          "sourceSystem": "contract_repository",
          "entityType": "kpi-definition-set",
          "entityId": "DEMO-CONTRACT/demo-v1",
          "observedAt": "2026-08-01T00:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1001",
          "observedAt": "2026-08-03T08:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1002",
          "observedAt": "2026-08-10T10:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1003",
          "observedAt": "2026-08-17T09:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1004",
          "observedAt": "2026-08-25T06:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1005",
          "observedAt": "2026-08-29T07:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1006",
          "observedAt": "2026-08-30T07:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1007",
          "observedAt": "2026-08-12T07:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1008",
          "observedAt": "2026-08-18T07:00:00Z"
        }
      ],
      "reason": "Breach on availability (decision-grade)."
    },
    {
      "obligationId": "OBL-RELIAB",
      "clauseRef": "Demo clause 12.2",
      "kind": "kpi",
      "title": "Reliability and repair time",
      "description": "Keep MTBF above and MTTR below the demo thresholds.",
      "owner": "contractor",
      "kpiIds": [
        "mtbf",
        "mttr"
      ],
      "evidenceRules": [
        "Corrective work orders with reported, start and completion timestamps"
      ],
      "consequence": "Demo remediation plan within 10 days of a breach (synthetic).",
      "effectiveFrom": "2026-01-01T00:00:00Z",
      "status": "breached",
      "kpis": [
        {
          "kpiId": "mtbf",
          "value": 183.25,
          "status": "within_target",
          "readiness": "PROVISIONAL",
          "decisionGrade": true
        },
        {
          "kpiId": "mttr",
          "value": 2.75,
          "status": "breach",
          "readiness": "PROVISIONAL",
          "decisionGrade": true
        }
      ],
      "evidence": [
        {
          "sourceSystem": "contract_repository",
          "entityType": "kpi-definition-set",
          "entityId": "DEMO-CONTRACT/demo-v1",
          "observedAt": "2026-08-01T00:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1001",
          "observedAt": "2026-08-03T08:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1002",
          "observedAt": "2026-08-10T10:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1003",
          "observedAt": "2026-08-17T09:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1004",
          "observedAt": "2026-08-25T06:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1005",
          "observedAt": "2026-08-29T07:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1006",
          "observedAt": "2026-08-30T07:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1007",
          "observedAt": "2026-08-12T07:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1008",
          "observedAt": "2026-08-18T07:00:00Z"
        },
        {
          "sourceSystem": "contract_repository",
          "entityType": "kpi-definition-set",
          "entityId": "DEMO-CONTRACT/demo-v1",
          "observedAt": "2026-08-01T00:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1001",
          "observedAt": "2026-08-03T08:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1002",
          "observedAt": "2026-08-10T10:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1003",
          "observedAt": "2026-08-17T09:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1004",
          "observedAt": "2026-08-25T06:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1005",
          "observedAt": "2026-08-29T07:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1006",
          "observedAt": "2026-08-30T07:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1007",
          "observedAt": "2026-08-12T07:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1008",
          "observedAt": "2026-08-18T07:00:00Z"
        }
      ],
      "reason": "Breach on mttr (decision-grade)."
    },
    {
      "obligationId": "OBL-PM",
      "clauseRef": "Demo clause 14.3",
      "kind": "kpi",
      "title": "Preventive maintenance compliance",
      "description": "Complete scheduled preventive maintenance within its target window.",
      "owner": "contractor",
      "kpiIds": [
        "pm_compliance"
      ],
      "evidenceRules": [
        "Preventive work orders with target start and completion timestamps"
      ],
      "effectiveFrom": "2026-01-01T00:00:00Z",
      "status": "breached",
      "kpis": [
        {
          "kpiId": "pm_compliance",
          "value": 50,
          "status": "breach",
          "readiness": "PROVISIONAL",
          "decisionGrade": true
        }
      ],
      "evidence": [
        {
          "sourceSystem": "contract_repository",
          "entityType": "kpi-definition-set",
          "entityId": "DEMO-CONTRACT/demo-v1",
          "observedAt": "2026-08-01T00:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1001",
          "observedAt": "2026-08-03T08:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1002",
          "observedAt": "2026-08-10T10:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1003",
          "observedAt": "2026-08-17T09:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1004",
          "observedAt": "2026-08-25T06:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1005",
          "observedAt": "2026-08-29T07:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1006",
          "observedAt": "2026-08-30T07:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1007",
          "observedAt": "2026-08-12T07:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1008",
          "observedAt": "2026-08-18T07:00:00Z"
        }
      ],
      "reason": "Breach on pm_compliance (decision-grade)."
    },
    {
      "obligationId": "OBL-BACKLOG",
      "clauseRef": "Demo clause 14.5",
      "kind": "kpi",
      "title": "Backlog and failure count",
      "description": "Keep the open backlog and the failure count within the demo limits.",
      "owner": "contractor",
      "kpiIds": [
        "backlog",
        "failures"
      ],
      "evidenceRules": [
        "Open work orders at period close",
        "Corrective work orders in the period"
      ],
      "effectiveFrom": "2026-01-01T00:00:00Z",
      "status": "met",
      "kpis": [
        {
          "kpiId": "backlog",
          "value": 3,
          "status": "within_target",
          "readiness": "PROVISIONAL",
          "decisionGrade": true
        },
        {
          "kpiId": "failures",
          "value": 4,
          "status": "within_target",
          "readiness": "PROVISIONAL",
          "decisionGrade": true
        }
      ],
      "evidence": [
        {
          "sourceSystem": "contract_repository",
          "entityType": "kpi-definition-set",
          "entityId": "DEMO-CONTRACT/demo-v1",
          "observedAt": "2026-08-01T00:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1001",
          "observedAt": "2026-08-03T08:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1002",
          "observedAt": "2026-08-10T10:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1003",
          "observedAt": "2026-08-17T09:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1004",
          "observedAt": "2026-08-25T06:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1005",
          "observedAt": "2026-08-29T07:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1006",
          "observedAt": "2026-08-30T07:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1007",
          "observedAt": "2026-08-12T07:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1008",
          "observedAt": "2026-08-18T07:00:00Z"
        },
        {
          "sourceSystem": "contract_repository",
          "entityType": "kpi-definition-set",
          "entityId": "DEMO-CONTRACT/demo-v1",
          "observedAt": "2026-08-01T00:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1001",
          "observedAt": "2026-08-03T08:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1002",
          "observedAt": "2026-08-10T10:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1003",
          "observedAt": "2026-08-17T09:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1004",
          "observedAt": "2026-08-25T06:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1005",
          "observedAt": "2026-08-29T07:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1006",
          "observedAt": "2026-08-30T07:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1007",
          "observedAt": "2026-08-12T07:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1008",
          "observedAt": "2026-08-18T07:00:00Z"
        }
      ],
      "reason": "All 2 bound KPI(s) within their approved threshold on decision-grade data."
    },
    {
      "obligationId": "OBL-EVIDENCE",
      "clauseRef": "Demo clause 20.1",
      "kind": "evidence",
      "title": "Evidence retention",
      "description": "Retain source records for every reported KPI and make them available on request.",
      "owner": "contractor",
      "evidenceRules": [
        "Work order history retained for the contract term"
      ],
      "effectiveFrom": "2026-01-01T00:00:00Z",
      "status": "not_evaluated",
      "kpis": [],
      "evidence": [],
      "reason": "evidence obligations are recorded but not evaluated automatically in P0."
    },
    {
      "obligationId": "OBL-REVIEW",
      "clauseRef": "Demo clause 21.2",
      "kind": "response",
      "title": "Owner review response",
      "description": "Respond to owner review comments on a report package within 5 working days.",
      "owner": "contractor",
      "evidenceRules": [
        "Dated review comment sheet and response"
      ],
      "effectiveFrom": "2026-01-01T00:00:00Z",
      "status": "not_evaluated",
      "kpis": [],
      "evidence": [],
      "reason": "response obligations are recorded but not evaluated automatically in P0."
    },
    {
      "obligationId": "OBL-FUTURE",
      "clauseRef": "Demo clause 30.1",
      "kind": "kpi",
      "title": "Future obligation (not yet effective)",
      "description": "A demo obligation that starts after the evaluated period, to show effectivity handling.",
      "owner": "contractor",
      "kpiIds": [
        "availability"
      ],
      "evidenceRules": [],
      "effectiveFrom": "2027-01-01T00:00:00Z",
      "status": "not_effective",
      "kpis": [],
      "evidence": [],
      "reason": "Obligation is not effective for the evaluated period."
    }
  ],
  "reportingDuties": [
    {
      "dutyId": "DUTY-MONTHLY",
      "clauseRef": "Demo clause 18.1",
      "cadence": "monthly",
      "title": "Monthly performance report",
      "dueDaysAfterPeriodEnd": 10,
      "requiredContents": [
        "KPI results with evidence references",
        "Exceptions and decisions required",
        "Named approval"
      ],
      "recipients": [
        "Demo asset owner"
      ],
      "status": "due",
      "reportId": "DEMO-2026-08",
      "reportStatus": "draft",
      "dueAt": "2026-09-10T23:59:59.000Z",
      "reason": "Package DEMO-2026-08 is draft; due 2026-09-10."
    },
    {
      "dutyId": "DUTY-QUARTERLY",
      "clauseRef": "Demo clause 18.2",
      "cadence": "quarterly",
      "title": "Quarterly executive review",
      "dueDaysAfterPeriodEnd": 20,
      "requiredContents": [
        "Trend across the quarter",
        "Remediation status"
      ],
      "recipients": [
        "Demo asset owner",
        "Demo steering committee"
      ],
      "status": "due",
      "reportId": null,
      "reportStatus": null,
      "dueAt": null,
      "reason": "Duty cadence quarterly is not evaluated against the monthly package."
    }
  ],
  "counts": {
    "obligations": 7,
    "met": 1,
    "breached": 3,
    "notDecisionGrade": 0,
    "notEvaluated": 3,
    "dutiesOverdue": 0
  },
  "evidence": {
    "sourceSystem": "contract_repository",
    "entityType": "contract-twin",
    "entityId": "DEMO-CONTRACT/demo-twin-v1",
    "observedAt": "2026-08-01T00:00:00Z"
  },
  "provenance": {
    "facts": {
      "dataModule": "src/demo.ts",
      "engineModule": "src/kpi/engine.ts",
      "formulaVersion": "demo-v1",
      "synthetic": true,
      "mode": "synthetic",
      "providers": [
        "synthetic-maximo",
        "synthetic-contract",
        "synthetic-condition",
        "synthetic-finance"
      ]
    },
    "twinSource": "synthetic://contract_repository/contract-twin/DEMO-CONTRACT"
  }
};
