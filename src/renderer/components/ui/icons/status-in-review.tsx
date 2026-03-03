import { SVGProps } from "react"

const StatusInReview = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 16 16" fill="none" {...props}>
    <circle cx={8} cy={8} r={6.5} stroke="currentColor" strokeWidth={1.5} />
    <path
      fill="currentColor"
      d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5A6.5 6.5 0 0 1 8 14.5a6.5 6.5 0 0 1-6.5-6.5H8V1.5Z"
    />
  </svg>
)

export default StatusInReview
