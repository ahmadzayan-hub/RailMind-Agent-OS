// GENERATED FILE. Do not edit by hand.
// Source: src/web/demo-pack.ts via `npm run build:web-data`. Verified by `npm run check:web-data`.
// Static fallback for hosting without the API. Produced by the Control Tower application service from the synthetic provider.
export const DEMO_PACK = {
  "provenance": {
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
  "generatedAt": "2026-08-31T23:59:59Z",
  "asOf": "2026-08-31T23:59:59Z",
  "report": {
    "reportId": "DEMO-2026-08",
    "cadence": "monthly",
    "contractId": "DEMO-CONTRACT",
    "periodStart": "2026-08-01T00:00:00Z",
    "periodEnd": "2026-08-31T23:59:59Z",
    "status": "draft"
  },
  "summary": "Monthly report DEMO-2026-08. 3/6 KPIs are within target. 3 KPI breach(es); 1 critical and 2 high exception(s). 6 KPI(s) provisional: KPI definition set demo-v1 is DEMO ONLY and not contractually approved. This summary is deterministic and contains no LLM-generated facts.",
  "controlTower": {
    "reportId": "DEMO-2026-08",
    "status": "draft",
    "kpiCount": 6,
    "withinTarget": 3,
    "watch": 0,
    "breach": 3,
    "criticalExceptions": 1,
    "highExceptions": 2,
    "attentionRequired": 3
  },
  "approvalGate": {
    "status": "draft",
    "nextTransitions": [
      "submit_for_review"
    ],
    "blockers": []
  },
  "readiness": {
    "state": "PROVISIONAL",
    "evaluatedAt": "2026-08-31T23:59:59Z",
    "issues": [
      {
        "code": "demo_kpi_definition",
        "severity": "warn",
        "detail": "KPI definition set demo-v1 is DEMO ONLY and not contractually approved.",
        "kpiIds": []
      }
    ],
    "perKpi": {
      "availability": {
        "state": "PROVISIONAL",
        "issues": [
          {
            "code": "demo_kpi_definition",
            "severity": "warn",
            "detail": "KPI definition set demo-v1 is DEMO ONLY and not contractually approved.",
            "kpiIds": []
          }
        ]
      },
      "failures": {
        "state": "PROVISIONAL",
        "issues": [
          {
            "code": "demo_kpi_definition",
            "severity": "warn",
            "detail": "KPI definition set demo-v1 is DEMO ONLY and not contractually approved.",
            "kpiIds": []
          }
        ]
      },
      "mtbf": {
        "state": "PROVISIONAL",
        "issues": [
          {
            "code": "demo_kpi_definition",
            "severity": "warn",
            "detail": "KPI definition set demo-v1 is DEMO ONLY and not contractually approved.",
            "kpiIds": []
          }
        ]
      },
      "mttr": {
        "state": "PROVISIONAL",
        "issues": [
          {
            "code": "demo_kpi_definition",
            "severity": "warn",
            "detail": "KPI definition set demo-v1 is DEMO ONLY and not contractually approved.",
            "kpiIds": []
          }
        ]
      },
      "backlog": {
        "state": "PROVISIONAL",
        "issues": [
          {
            "code": "demo_kpi_definition",
            "severity": "warn",
            "detail": "KPI definition set demo-v1 is DEMO ONLY and not contractually approved.",
            "kpiIds": []
          }
        ]
      },
      "pm_compliance": {
        "state": "PROVISIONAL",
        "issues": [
          {
            "code": "demo_kpi_definition",
            "severity": "warn",
            "detail": "KPI definition set demo-v1 is DEMO ONLY and not contractually approved.",
            "kpiIds": []
          }
        ]
      }
    },
    "freshness": {
      "latestObservedAt": "2026-08-30T07:00:00Z",
      "latestIngestedAt": "2026-09-01T00:00:00Z",
      "ageHours": 0,
      "maxAgeHours": 168
    },
    "counts": {
      "records": 8,
      "verified": 8,
      "provisional": 0,
      "rejected": 0
    }
  },
  "freshness": {
    "latestObservedAt": "2026-08-30T07:00:00Z",
    "ingestedAt": "2026-09-01T00:00:00Z",
    "ageHours": 0,
    "records": 8
  },
  "kpis": [
    {
      "id": "availability",
      "name": "Availability",
      "unit": "%",
      "value": 98.522,
      "threshold": 99.5,
      "direction": "higher_is_better",
      "formulaVersion": "demo-v1",
      "status": "breach",
      "readiness": {
        "state": "PROVISIONAL",
        "reasons": [
          "KPI definition set demo-v1 is DEMO ONLY and not contractually approved."
        ]
      },
      "decisionGrade": true,
      "exceptionId": "DEMO-CONTRACT:availability:2026-08-31T23:59:59Z",
      "severity": "high",
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
      ]
    },
    {
      "id": "failures",
      "name": "Failures",
      "unit": "count",
      "value": 4,
      "threshold": 4,
      "direction": "lower_is_better",
      "formulaVersion": "demo-v1",
      "status": "within_target",
      "readiness": {
        "state": "PROVISIONAL",
        "reasons": [
          "KPI definition set demo-v1 is DEMO ONLY and not contractually approved."
        ]
      },
      "decisionGrade": true,
      "exceptionId": null,
      "severity": null,
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
      ]
    },
    {
      "id": "mtbf",
      "name": "MTBF",
      "unit": "hours",
      "value": 183.25,
      "threshold": 120,
      "direction": "higher_is_better",
      "formulaVersion": "demo-v1",
      "status": "within_target",
      "readiness": {
        "state": "PROVISIONAL",
        "reasons": [
          "KPI definition set demo-v1 is DEMO ONLY and not contractually approved."
        ]
      },
      "decisionGrade": true,
      "exceptionId": null,
      "severity": null,
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
      ]
    },
    {
      "id": "mttr",
      "name": "MTTR",
      "unit": "hours",
      "value": 2.75,
      "threshold": 2,
      "direction": "lower_is_better",
      "formulaVersion": "demo-v1",
      "status": "breach",
      "readiness": {
        "state": "PROVISIONAL",
        "reasons": [
          "KPI definition set demo-v1 is DEMO ONLY and not contractually approved."
        ]
      },
      "decisionGrade": true,
      "exceptionId": "DEMO-CONTRACT:mttr:2026-08-31T23:59:59Z",
      "severity": "critical",
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
      ]
    },
    {
      "id": "backlog",
      "name": "Maintenance Backlog",
      "unit": "work orders",
      "value": 3,
      "threshold": 5,
      "direction": "lower_is_better",
      "formulaVersion": "demo-v1",
      "status": "within_target",
      "readiness": {
        "state": "PROVISIONAL",
        "reasons": [
          "KPI definition set demo-v1 is DEMO ONLY and not contractually approved."
        ]
      },
      "decisionGrade": true,
      "exceptionId": null,
      "severity": null,
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
      ]
    },
    {
      "id": "pm_compliance",
      "name": "PM Compliance",
      "unit": "%",
      "value": 50,
      "threshold": 90,
      "direction": "higher_is_better",
      "formulaVersion": "demo-v1",
      "status": "breach",
      "readiness": {
        "state": "PROVISIONAL",
        "reasons": [
          "KPI definition set demo-v1 is DEMO ONLY and not contractually approved."
        ]
      },
      "decisionGrade": true,
      "exceptionId": "DEMO-CONTRACT:pm_compliance:2026-08-31T23:59:59Z",
      "severity": "high",
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
      ]
    }
  ],
  "exceptions": [
    {
      "id": "DEMO-CONTRACT:mttr:2026-08-31T23:59:59Z",
      "kpiId": "mttr",
      "severity": "critical",
      "title": "MTTR breach",
      "whyItMatters": "MTTR is 2.75 hours; approved threshold is 2 hours.",
      "decisionRequired": "Named contract/maintenance owner to review root cause and mitigation before report approval.",
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
      "kind": "kpi"
    },
    {
      "id": "DEMO-CONTRACT:availability:2026-08-31T23:59:59Z",
      "kpiId": "availability",
      "severity": "high",
      "title": "Availability breach",
      "whyItMatters": "Availability is 98.522 %; approved threshold is 99.5 %.",
      "decisionRequired": "Review cause, evidence and corrective action during the current reporting cycle.",
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
      "kind": "kpi"
    },
    {
      "id": "DEMO-CONTRACT:pm_compliance:2026-08-31T23:59:59Z",
      "kpiId": "pm_compliance",
      "severity": "high",
      "title": "PM Compliance breach",
      "whyItMatters": "PM Compliance is 50 %; approved threshold is 90 %.",
      "decisionRequired": "Review cause, evidence and corrective action during the current reporting cycle.",
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
      "kind": "kpi"
    }
  ],
  "assets": [
    {
      "assetId": "ATC-ZC-01",
      "openWorkOrders": 1,
      "failureWorkOrders": 1,
      "downtimeMinutes": 120,
      "lastReportedAt": "2026-08-29T07:00:00Z"
    },
    {
      "assetId": "ATC-ZC-02",
      "openWorkOrders": 0,
      "failureWorkOrders": 2,
      "downtimeMinutes": 330,
      "lastReportedAt": "2026-08-17T09:00:00Z"
    },
    {
      "assetId": "TRAM-APS-03",
      "openWorkOrders": 2,
      "failureWorkOrders": 1,
      "downtimeMinutes": 210,
      "lastReportedAt": "2026-08-30T07:00:00Z"
    }
  ],
  "workOrders": [
    {
      "workOrderId": "WO-1001",
      "assetId": "ATC-ZC-01",
      "workType": "CM",
      "status": "COMP",
      "reportedAt": "2026-08-03T08:00:00Z",
      "completedAt": "2026-08-03T10:20:00Z",
      "downtimeMinutes": 120,
      "failureCode": "COMM"
    },
    {
      "workOrderId": "WO-1002",
      "assetId": "ATC-ZC-02",
      "workType": "CM",
      "status": "COMP",
      "reportedAt": "2026-08-10T10:00:00Z",
      "completedAt": "2026-08-10T13:10:00Z",
      "downtimeMinutes": 180,
      "failureCode": "HW"
    },
    {
      "workOrderId": "WO-1003",
      "assetId": "ATC-ZC-02",
      "workType": "CM",
      "status": "COMP",
      "reportedAt": "2026-08-17T09:00:00Z",
      "completedAt": "2026-08-17T11:35:00Z",
      "downtimeMinutes": 150,
      "failureCode": "HW"
    },
    {
      "workOrderId": "WO-1004",
      "assetId": "TRAM-APS-03",
      "workType": "CM",
      "status": "INPRG",
      "reportedAt": "2026-08-25T06:00:00Z",
      "completedAt": null,
      "downtimeMinutes": 210,
      "failureCode": "POWER"
    },
    {
      "workOrderId": "WO-1005",
      "assetId": "ATC-ZC-01",
      "workType": "PM",
      "status": "WAPPR",
      "reportedAt": "2026-08-29T07:00:00Z",
      "completedAt": null,
      "downtimeMinutes": 0,
      "failureCode": null
    },
    {
      "workOrderId": "WO-1006",
      "assetId": "TRAM-APS-03",
      "workType": "PM",
      "status": "WAPPR",
      "reportedAt": "2026-08-30T07:00:00Z",
      "completedAt": null,
      "downtimeMinutes": 0,
      "failureCode": null
    },
    {
      "workOrderId": "WO-1007",
      "assetId": "ATC-ZC-02",
      "workType": "PM",
      "status": "COMP",
      "reportedAt": "2026-08-12T07:00:00Z",
      "completedAt": "2026-08-13T11:00:00Z",
      "downtimeMinutes": 0,
      "failureCode": null
    },
    {
      "workOrderId": "WO-1008",
      "assetId": "TRAM-APS-03",
      "workType": "PM",
      "status": "COMP",
      "reportedAt": "2026-08-18T07:00:00Z",
      "completedAt": "2026-08-19T12:30:00Z",
      "downtimeMinutes": 0,
      "failureCode": null
    }
  ],
  "timeline": [
    {
      "asOf": "2026-08-03T08:00:00Z",
      "trigger": "WO-1001",
      "workOrdersSeen": 1,
      "kpis": [
        {
          "id": "availability",
          "value": 96.429,
          "status": "breach",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "failures",
          "value": 1,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "mtbf",
          "value": 54,
          "status": "breach",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "mttr",
          "value": 2,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "backlog",
          "value": 0,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "pm_compliance",
          "value": 100,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        }
      ]
    },
    {
      "asOf": "2026-08-10T10:00:00Z",
      "trigger": "WO-1002",
      "workOrdersSeen": 2,
      "kpis": [
        {
          "id": "availability",
          "value": 97.788,
          "status": "breach",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "failures",
          "value": 2,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "mtbf",
          "value": 110.5,
          "status": "breach",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "mttr",
          "value": 2.5,
          "status": "breach",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "backlog",
          "value": 0,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "pm_compliance",
          "value": 100,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        }
      ]
    },
    {
      "asOf": "2026-08-12T07:00:00Z",
      "trigger": "WO-1007",
      "workOrdersSeen": 3,
      "kpis": [
        {
          "id": "availability",
          "value": 98.155,
          "status": "breach",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "failures",
          "value": 2,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "mtbf",
          "value": 133,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "mttr",
          "value": 2.5,
          "status": "breach",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "backlog",
          "value": 0,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "pm_compliance",
          "value": 100,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        }
      ]
    },
    {
      "asOf": "2026-08-17T09:00:00Z",
      "trigger": "WO-1003",
      "workOrdersSeen": 4,
      "kpis": [
        {
          "id": "availability",
          "value": 98.092,
          "status": "breach",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "failures",
          "value": 3,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "mtbf",
          "value": 128.5,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "mttr",
          "value": 2.5,
          "status": "breach",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "backlog",
          "value": 0,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "pm_compliance",
          "value": 100,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        }
      ]
    },
    {
      "asOf": "2026-08-18T07:00:00Z",
      "trigger": "WO-1008",
      "workOrdersSeen": 5,
      "kpis": [
        {
          "id": "availability",
          "value": 98.193,
          "status": "breach",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "failures",
          "value": 3,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "mtbf",
          "value": 135.83,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "mttr",
          "value": 2.5,
          "status": "breach",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "backlog",
          "value": 0,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "pm_compliance",
          "value": 100,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        }
      ]
    },
    {
      "asOf": "2026-08-25T06:00:00Z",
      "trigger": "WO-1004",
      "workOrdersSeen": 6,
      "kpis": [
        {
          "id": "availability",
          "value": 98.11,
          "status": "breach",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "failures",
          "value": 4,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "mtbf",
          "value": 142.75,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "mttr",
          "value": 2.75,
          "status": "breach",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "backlog",
          "value": 1,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "pm_compliance",
          "value": 100,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        }
      ]
    },
    {
      "asOf": "2026-08-29T07:00:00Z",
      "trigger": "WO-1005",
      "workOrdersSeen": 7,
      "kpis": [
        {
          "id": "availability",
          "value": 98.38,
          "status": "breach",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "failures",
          "value": 4,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "mtbf",
          "value": 167,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "mttr",
          "value": 2.75,
          "status": "breach",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "backlog",
          "value": 2,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "pm_compliance",
          "value": 66.7,
          "status": "breach",
          "readiness": "PROVISIONAL"
        }
      ]
    },
    {
      "asOf": "2026-08-30T07:00:00Z",
      "trigger": "WO-1006",
      "workOrdersSeen": 8,
      "kpis": [
        {
          "id": "availability",
          "value": 98.435,
          "status": "breach",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "failures",
          "value": 4,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "mtbf",
          "value": 173,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "mttr",
          "value": 2.75,
          "status": "breach",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "backlog",
          "value": 3,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "pm_compliance",
          "value": 50,
          "status": "breach",
          "readiness": "PROVISIONAL"
        }
      ]
    },
    {
      "asOf": "2026-08-31T23:59:59Z",
      "trigger": "PERIOD-CLOSE",
      "workOrdersSeen": 8,
      "kpis": [
        {
          "id": "availability",
          "value": 98.522,
          "status": "breach",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "failures",
          "value": 4,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "mtbf",
          "value": 183.25,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "mttr",
          "value": 2.75,
          "status": "breach",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "backlog",
          "value": 3,
          "status": "within_target",
          "readiness": "PROVISIONAL"
        },
        {
          "id": "pm_compliance",
          "value": 50,
          "status": "breach",
          "readiness": "PROVISIONAL"
        }
      ]
    }
  ],
  "agents": [
    {
      "id": "data-quality",
      "name": "Data Quality Agent",
      "mayUseModel": false,
      "allowedActionModes": [
        "read",
        "analyse",
        "draft"
      ]
    },
    {
      "id": "asset-intelligence",
      "name": "Asset Intelligence Agent",
      "mayUseModel": true,
      "allowedActionModes": [
        "read",
        "analyse",
        "draft",
        "propose_write"
      ]
    },
    {
      "id": "maintenance-kpi",
      "name": "Maintenance KPI Agent",
      "mayUseModel": true,
      "allowedActionModes": [
        "read",
        "analyse",
        "draft"
      ]
    },
    {
      "id": "reporting",
      "name": "Reporting Agent",
      "mayUseModel": true,
      "allowedActionModes": [
        "read",
        "analyse",
        "draft"
      ]
    },
    {
      "id": "executive-briefing",
      "name": "Executive Briefing Agent",
      "mayUseModel": true,
      "allowedActionModes": [
        "read",
        "analyse",
        "draft"
      ]
    },
    {
      "id": "contract-context",
      "name": "Contract Context Agent",
      "mayUseModel": true,
      "allowedActionModes": [
        "read",
        "analyse",
        "draft"
      ]
    },
    {
      "id": "finance-context",
      "name": "Finance Context Agent",
      "mayUseModel": false,
      "allowedActionModes": [
        "read",
        "analyse",
        "draft"
      ]
    }
  ]
};
