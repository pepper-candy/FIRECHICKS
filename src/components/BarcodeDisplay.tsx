import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface Props {
  value: string;
  className?: string;
  height?: number;
}

export default function BarcodeDisplay({ value, className, height = 40 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    JsBarcode(svgRef.current, value, {
      format: "CODE128",
      displayValue: false,
      margin: 4,
      width: 1.4,
      height,
      background: "#ffffff",
      lineColor: "#000000",
    });
  }, [value, height]);

  return <svg ref={svgRef} className={className} aria-label={`Barcode ${value}`} role="img" />;
}
