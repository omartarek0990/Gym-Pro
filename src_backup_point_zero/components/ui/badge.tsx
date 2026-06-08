import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-yellow-600 text-black",
        secondary: "border-[#1a1a2e] bg-[#111] text-gray-300",
        destructive: "border-transparent bg-red-600/20 text-red-400",
        success: "border-transparent bg-green-600/20 text-green-400",
        warning: "border-transparent bg-yellow-600/20 text-yellow-400",
        outline: "text-white border-[#1a1a2e]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
