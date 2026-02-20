import { SVGProps } from "react"

const StatusInReview = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 16 16" fill="none" {...props}>
    <circle cx={8} cy={8} r={6.5} stroke="currentColor" strokeWidth={1.5} />
    <path d="M8 1.5A6.5 6.5 0 0 1 14.5 8 6.5 6.5 0 0 1 8 14.5 6.5 6.5 0 0 1 1.5 8V1.5H8Z" fill="currentColor" fillRule="evenodd" />
  </svg>
)

export default StatusInReview
