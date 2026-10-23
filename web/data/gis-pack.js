// GENERATED FILE. Do not edit by hand.
// Source: src/web/gis-pack.ts via `npm run build:web-data`. Verified by `npm run check:web-data`.
// Synthetic schematic joined with the Control Tower DTO. Positions are canvas percentages, not coordinates.
export const GIS_PACK = {
  "generatedAt": "2026-08-31T23:59:59Z",
  "provenance": {
    "schematic": {
      "kind": "synthetic_schematic",
      "note": "Synthetic presentation schematic. Positions are canvas percentages, not coordinates. Station names are illustrative. Train markers are simulated movement.",
      "observedAt": "2026-08-01T00:00:00Z"
    },
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
    "reportId": "DEMO-2026-08",
    "contractId": "DEMO-CONTRACT",
    "positionsAreCoordinates": false
  },
  "line": {
    "lineId": "DEMO-RED",
    "label": {
      "ar": "نموذج الخط الأحمر التوضيحي",
      "en": "Illustrative Red Line model"
    },
    "path": "M54 444 C 160 402, 188 486, 278 410 S 400 275, 490 342 S 594 465, 700 352 S 843 190, 948 100",
    "viewBox": {
      "width": 1000,
      "height": 580
    }
  },
  "nodes": [
    {
      "nodeId": "st-01",
      "kind": "station",
      "layer": "stations",
      "code": "ST-01",
      "label": {
        "ar": "محطة المركز المالي",
        "en": "Financial Centre Station"
      },
      "position": {
        "x": 74.2,
        "y": 71
      },
      "refs": {
        "assetIds": [
          "ATC-ZC-01"
        ]
      },
      "status": "watch",
      "facts": [
        {
          "key": "linkedAssets",
          "value": 1
        },
        {
          "key": "openWorkOrders",
          "value": 1
        }
      ],
      "evidence": [
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1001",
          "observedAt": "2026-08-03T08:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1005",
          "observedAt": "2026-08-29T07:00:00Z"
        }
      ],
      "exceptionId": null
    },
    {
      "nodeId": "st-02",
      "kind": "station",
      "layer": "stations",
      "code": "ST-02",
      "label": {
        "ar": "محطة منطقة المتحف",
        "en": "Museum District Station"
      },
      "position": {
        "x": 51,
        "y": 59
      },
      "refs": {
        "assetIds": [
          "ATC-ZC-02"
        ]
      },
      "status": "watch",
      "facts": [
        {
          "key": "linkedAssets",
          "value": 1
        },
        {
          "key": "openWorkOrders",
          "value": 0
        }
      ],
      "evidence": [
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
          "entityId": "WO-1007",
          "observedAt": "2026-08-12T07:00:00Z"
        }
      ],
      "exceptionId": null
    },
    {
      "nodeId": "st-03",
      "kind": "station",
      "layer": "stations",
      "code": "ST-03",
      "label": {
        "ar": "محطة المارينا",
        "en": "Marina Station"
      },
      "position": {
        "x": 30,
        "y": 61
      },
      "refs": {
        "assetIds": [
          "TRAM-APS-03"
        ]
      },
      "status": "critical",
      "facts": [
        {
          "key": "linkedAssets",
          "value": 1
        },
        {
          "key": "openWorkOrders",
          "value": 2
        }
      ],
      "evidence": [
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1004",
          "observedAt": "2026-08-25T06:00:00Z"
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
          "entityId": "WO-1008",
          "observedAt": "2026-08-18T07:00:00Z"
        }
      ],
      "exceptionId": null
    },
    {
      "nodeId": "st-04",
      "kind": "station",
      "layer": "stations",
      "code": "ST-04",
      "label": {
        "ar": "المحطة الطرفية",
        "en": "Terminal Station"
      },
      "position": {
        "x": 5.2,
        "y": 17
      },
      "status": "stable",
      "facts": [
        {
          "key": "linkedAssets",
          "value": 0
        },
        {
          "key": "openWorkOrders",
          "value": 0
        }
      ],
      "evidence": [],
      "exceptionId": null
    },
    {
      "nodeId": "asset-atc-zc-01",
      "kind": "asset",
      "layer": "assets",
      "code": "ATC-ZC-01",
      "label": {
        "ar": "وحدة تحكم المنطقة 01",
        "en": "Zone controller 01"
      },
      "position": {
        "x": 64,
        "y": 38
      },
      "refs": {
        "assetIds": [
          "ATC-ZC-01"
        ]
      },
      "status": "watch",
      "facts": [
        {
          "key": "assetStatus",
          "value": "watch"
        },
        {
          "key": "openWorkOrders",
          "value": 1
        },
        {
          "key": "failureWorkOrders",
          "value": 1
        },
        {
          "key": "downtimeMinutes",
          "value": 120
        }
      ],
      "evidence": [
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1001",
          "observedAt": "2026-08-03T08:00:00Z"
        },
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1005",
          "observedAt": "2026-08-29T07:00:00Z"
        }
      ],
      "exceptionId": "DEMO-CONTRACT:mttr:2026-08-31T23:59:59Z"
    },
    {
      "nodeId": "asset-atc-zc-02",
      "kind": "asset",
      "layer": "assets",
      "code": "ATC-ZC-02",
      "label": {
        "ar": "وحدة تحكم المنطقة 02",
        "en": "Zone controller 02"
      },
      "position": {
        "x": 44,
        "y": 44
      },
      "refs": {
        "assetIds": [
          "ATC-ZC-02"
        ]
      },
      "status": "watch",
      "facts": [
        {
          "key": "assetStatus",
          "value": "watch"
        },
        {
          "key": "openWorkOrders",
          "value": 0
        },
        {
          "key": "failureWorkOrders",
          "value": 2
        },
        {
          "key": "downtimeMinutes",
          "value": 330
        }
      ],
      "evidence": [
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
          "entityId": "WO-1007",
          "observedAt": "2026-08-12T07:00:00Z"
        }
      ],
      "exceptionId": "DEMO-CONTRACT:mttr:2026-08-31T23:59:59Z"
    },
    {
      "nodeId": "asset-tram-aps-03",
      "kind": "asset",
      "layer": "assets",
      "code": "TRAM-APS-03",
      "label": {
        "ar": "قطاع التغذية الأرضية 03",
        "en": "APS segment 03"
      },
      "position": {
        "x": 22,
        "y": 33
      },
      "refs": {
        "assetIds": [
          "TRAM-APS-03"
        ]
      },
      "status": "critical",
      "facts": [
        {
          "key": "assetStatus",
          "value": "critical"
        },
        {
          "key": "openWorkOrders",
          "value": 2
        },
        {
          "key": "failureWorkOrders",
          "value": 1
        },
        {
          "key": "downtimeMinutes",
          "value": 210
        }
      ],
      "evidence": [
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1004",
          "observedAt": "2026-08-25T06:00:00Z"
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
          "entityId": "WO-1008",
          "observedAt": "2026-08-18T07:00:00Z"
        }
      ],
      "exceptionId": "DEMO-CONTRACT:mttr:2026-08-31T23:59:59Z"
    },
    {
      "nodeId": "exception-mttr",
      "kind": "exception",
      "layer": "faults",
      "code": "MTTR",
      "label": {
        "ar": "تنبيه زمن الإصلاح",
        "en": "Repair-time alert"
      },
      "position": {
        "x": 34,
        "y": 49
      },
      "refs": {
        "kpiId": "mttr",
        "assetIds": [
          "ATC-ZC-02"
        ]
      },
      "status": "critical",
      "facts": [
        {
          "key": "kpi",
          "value": "mttr demo-v1"
        },
        {
          "key": "kpiStatus",
          "value": "breach"
        },
        {
          "key": "severity",
          "value": "critical"
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
      "exceptionId": "DEMO-CONTRACT:mttr:2026-08-31T23:59:59Z"
    },
    {
      "nodeId": "wo-1005",
      "kind": "work-order",
      "layer": "workorders",
      "code": "WO-1005",
      "label": {
        "ar": "أمر عمل WO-1005",
        "en": "Work order WO-1005"
      },
      "position": {
        "x": 56,
        "y": 70
      },
      "refs": {
        "workOrderId": "WO-1005",
        "assetIds": [
          "ATC-ZC-01"
        ]
      },
      "status": "watch",
      "facts": [
        {
          "key": "workOrderStatus",
          "value": "WAPPR"
        },
        {
          "key": "workType",
          "value": "PM"
        },
        {
          "key": "downtimeMinutes",
          "value": 0
        }
      ],
      "evidence": [
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1005",
          "observedAt": "2026-08-29T07:00:00Z"
        }
      ],
      "exceptionId": null
    },
    {
      "nodeId": "wo-1006",
      "kind": "work-order",
      "layer": "workorders",
      "code": "WO-1006",
      "label": {
        "ar": "أمر عمل WO-1006",
        "en": "Work order WO-1006"
      },
      "position": {
        "x": 16,
        "y": 30
      },
      "refs": {
        "workOrderId": "WO-1006",
        "assetIds": [
          "TRAM-APS-03"
        ]
      },
      "status": "watch",
      "facts": [
        {
          "key": "workOrderStatus",
          "value": "WAPPR"
        },
        {
          "key": "workType",
          "value": "PM"
        },
        {
          "key": "downtimeMinutes",
          "value": 0
        }
      ],
      "evidence": [
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1006",
          "observedAt": "2026-08-30T07:00:00Z"
        }
      ],
      "exceptionId": null
    },
    {
      "nodeId": "wo-1004",
      "kind": "work-order",
      "layer": "workorders",
      "code": "WO-1004",
      "label": {
        "ar": "أمر عمل WO-1004",
        "en": "Work order WO-1004"
      },
      "position": {
        "x": 27,
        "y": 74
      },
      "refs": {
        "workOrderId": "WO-1004",
        "assetIds": [
          "TRAM-APS-03"
        ]
      },
      "status": "critical",
      "facts": [
        {
          "key": "workOrderStatus",
          "value": "INPRG"
        },
        {
          "key": "workType",
          "value": "CM"
        },
        {
          "key": "downtimeMinutes",
          "value": 210
        }
      ],
      "evidence": [
        {
          "sourceSystem": "maximo",
          "entityType": "work-order",
          "entityId": "WO-1004",
          "observedAt": "2026-08-25T06:00:00Z"
        }
      ],
      "exceptionId": null
    },
    {
      "nodeId": "train-r01",
      "kind": "train",
      "layer": "trains",
      "code": "R01",
      "label": {
        "ar": "قطار R01",
        "en": "Train R01"
      },
      "position": {
        "x": 80,
        "y": 60
      },
      "simulated": true,
      "status": "stable",
      "facts": [
        {
          "key": "simulated",
          "value": "true"
        }
      ],
      "evidence": [],
      "exceptionId": null
    },
    {
      "nodeId": "train-r02",
      "kind": "train",
      "layer": "trains",
      "code": "R02",
      "label": {
        "ar": "قطار R02",
        "en": "Train R02"
      },
      "position": {
        "x": 50,
        "y": 50
      },
      "simulated": true,
      "status": "stable",
      "facts": [
        {
          "key": "simulated",
          "value": "true"
        }
      ],
      "evidence": [],
      "exceptionId": null
    },
    {
      "nodeId": "train-r03",
      "kind": "train",
      "layer": "trains",
      "code": "R03",
      "label": {
        "ar": "قطار R03",
        "en": "Train R03"
      },
      "position": {
        "x": 20,
        "y": 30
      },
      "simulated": true,
      "status": "stable",
      "facts": [
        {
          "key": "simulated",
          "value": "true"
        }
      ],
      "evidence": [],
      "exceptionId": null
    }
  ],
  "counts": {
    "assets": 3,
    "criticalExceptions": 1,
    "openWorkOrders": 3,
    "byStatus": {
      "stable": 4,
      "watch": 6,
      "critical": 4
    }
  },
  "layers": [
    "stations",
    "assets",
    "faults",
    "workorders",
    "trains"
  ]
};
