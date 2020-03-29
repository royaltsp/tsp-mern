import React from "react";

import {
  Training,
  Ecomm,
  Securum,
  TableResize,
  Bootstrap,
  Table,
  Material
} from "./apps";

const apps = {
  1: "training",
  2: "ecomm",
  3: "securum",
  4: "table-resize",
  5: "bootstrap",
  6: "table",
  7: "material",
  8: "grid"
};

const appNumber = 5;
const app = apps[appNumber];

export default function App() {
  switch (app) {
    case "training":
      return <Training />;
    case "table":
      return <Table />;
    case "ecomm":
      return <Ecomm />;
    case "securum":
      return <Securum />;
    case "table-resize":
      return <TableResize />;
    case "bootstrap":
      return <Bootstrap />;
    case "material":
      return <Material />;
    default:
      return <Ecomm />;
  }
}
