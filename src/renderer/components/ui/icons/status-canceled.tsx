import { SVGProps } from "react"

const StatusCanceled = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 16 16" fill="none" {...props}>
    <circle cx={8} cy={8} r={7} fill="currentColor" />
    <path d="M5.75 5.75l4.5 4.5M10.25 5.75l-4.5 4.5" stroke="white" strokeWidth={1.5} strokeLinecap="round" />
  </svg>
)

export default StatusCanceled
