import * as React from "react"
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface AnalyticsCardProps {
  title: string
  value: string | number
  change?: {
    value: number
    /** Sens de la variation (flèche) */
    type: 'increase' | 'decrease' | 'neutral'
    /** Variation favorable ? (couleur) — par défaut une hausse est favorable */
    positive?: boolean
  }
  icon: LucideIcon
  description?: string
  className?: string
}

export function AnalyticsCard({
  title,
  value,
  change,
  icon: Icon,
  description,
  className
}: AnalyticsCardProps) {
  const getTrendColor = () => {
    if (!change || change.type === 'neutral') return 'text-gray-500'
    const positive = change.positive ?? change.type === 'increase'
    return positive ? 'text-green-500' : 'text-red-500'
  }

  const getTrendIcon = () => {
    switch (change?.type) {
      case 'increase':
        return <TrendingUp className={cn('h-4 w-4', getTrendColor())} />
      case 'decrease':
        return <TrendingDown className={cn('h-4 w-4', getTrendColor())} />
      default:
        return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1",
      "bg-card border-border shadow-lg",
      className
    )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground transition-colors duration-300">
          {title}
        </CardTitle>
        <div className="h-10 w-10 rounded-xl flex items-center justify-center shadow-lg transition-all duration-300 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700">
          <Icon className="h-5 w-5 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-foreground transition-colors duration-300">
          {value}
        </div>
        
        {change && (
          <div className="flex items-center space-x-2 mt-3">
            {getTrendIcon()}
            <span className={cn("text-xs font-semibold transition-colors duration-300", getTrendColor())}>
              {Math.abs(change.value)}%
            </span>
            <span className="text-xs text-muted-foreground transition-colors duration-300">
              vs la période précédente
            </span>
          </div>
        )}
        
        {description && (
          <p className="text-xs text-muted-foreground mt-3 transition-colors duration-300">
            {description}
          </p>
        )}
      </CardContent>
      
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent pointer-events-none dark:from-blue-600/5 dark:via-transparent" />
    </Card>
  )
}
