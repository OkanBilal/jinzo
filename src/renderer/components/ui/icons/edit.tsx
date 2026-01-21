import * as React from "react"
import { SVGProps } from "react"
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={800}
    height={800}
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 21a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2h-8a1 1 0 0 1-1-1ZM20.774 8.1c1.61-1.616 1.541-3.738.339-5.038A3.31 3.31 0 0 0 18.748 2c-.949-.022-1.931.34-2.838 1.099a.988.988 0 0 0-.067.061L2.874 16.181A3 3 0 0 0 2 18.3v1.693C2 21.094 2.892 22 4.004 22h1.679a3 3 0 0 0 2.125-.883L20.774 8.1Zm-3.567-2.307a1 1 0 1 0-1.414 1.414l1 1a1 1 0 1 0 1.414-1.414l-1-1Z"
      clipRule="evenodd"
    />
  </svg>
)
export default SvgComponent
