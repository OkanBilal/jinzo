import * as React from "react"
import { SVGProps } from "react"
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={16}
    height={16}
    fill="none"
    viewBox="0 0 16 16"
    {...props}
  >
    <defs>
      <mask id="cancel-cutout">
        <circle cx={8} cy={8} r={8} fill="white" />
        <path
          stroke="black"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="m5.5 10.5 5-5m0 5-5-5"
        />
      </mask>
    </defs>
    <circle cx={8} cy={8} r={8} fill="currentColor" mask="url(#cancel-cutout)" />
  </svg>
)
export default SvgComponent
