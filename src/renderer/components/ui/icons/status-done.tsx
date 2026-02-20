import { SVGProps } from "react"

const StatusDone = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 16 16" fill="none" {...props}>
    <circle cx={8} cy={8} r={7} fill="currentColor" />
    <path d="M5.5 8.5L7 10l3.5-4" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export default StatusDone
