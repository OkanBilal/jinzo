import { SVGProps } from "react";

const SvgComponent = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M10.07 7c.317-3.021 1.772-4 5.43-4C19.706 3 21 4.294 21 8.5c0 3.658-.979 5.113-4 5.43M3 15.5C3 11.294 4.294 10 8.5 10c4.206 0 5.5 1.294 5.5 5.5 0 4.206-1.294 5.5-5.5 5.5C4.294 21 3 19.706 3 15.5Z"
    />
  </svg>
);
export default SvgComponent;
