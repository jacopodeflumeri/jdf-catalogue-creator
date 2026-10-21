import React from 'react'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts'
import { config } from '@/config';

interface ChartDataPoint {
  label: string
  value: number
  color?: string
}

interface LineChartDataPoint {
  label: string
  [key: string]: string | number
}

interface LineChartSeries {
  key: string
  name: string
  color: string
}

interface ChartProps {
  title?: string
  data: ChartDataPoint[] | LineChartDataPoint[]
  type?: 'bar' | 'line' | 'pie'
  className?: string
  series?: LineChartSeries[] // For line charts with multiple series
  height?: number | string
  theme?: string
  noPadding?: boolean
  currencySymbol?: string // Optional currency symbol for formatting
}

const Chart = React.memo(function Chart({ 
  title, 
  data, 
  type = 'bar', 
  className = '', 
  noPadding = false,
  series, 
  height = 300,
  theme = 'light',
  currencySymbol
}: ChartProps) {
  // Color mapping for semantic names
  const colorMap: Record<string, string> = config.ui.theme;
  const colors = config.ui.chartColours

  // Helper function to resolve color
  const resolveColor = (color: string | undefined, fallbackIndex: number): string => {
    if (!color) return colors[fallbackIndex % colors.length]
    
    // Check if it's a semantic color name
    if (colorMap[color.toLowerCase()]) {
      return colorMap[color.toLowerCase()]
    }
    
    // Return as-is if it's already a hex color or other valid CSS color
    return color
  }


  // Generate ECharts option based on chart type
  const getOption = () => {
    const baseOption = {
      title: {
        text: title,
        left: 'center',
        textStyle: {
          fontSize: 18,
          fontWeight: 600,
          color: '#111827'
        }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderColor: '#e5e7eb',
        textStyle: {
          color: '#374151'
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '15%',
        containLabel: true
      }
    }

    if (type === 'line' && series) {
      const lineData = data as LineChartDataPoint[]
      
      return {
        ...baseOption,
        grid: {
          ...baseOption.grid,
          bottom: '20%'  // Extra padding for line charts with legend
        },
        tooltip: {
          ...baseOption.tooltip,
          trigger: 'axis'
        },
        legend: {
          data: series.map(s => s.name),
          bottom: '5%'
        },
        xAxis: {
          type: 'category',
          data: lineData.map(item => item.label),
          boundaryGap: false,  // This makes lines extend to the edges
          axisLine: {
            lineStyle: {
              color: '#d1d5db'
            }
          },
          axisLabel: {
            color: '#6b7280'
          }
        },
        yAxis: {
          type: 'value',
          axisLine: {
            lineStyle: {
              color: '#d1d5db'
            }
          },
          axisLabel: {
            color: '#6b7280'
          },
          splitLine: {
            lineStyle: {
              color: '#f3f4f6'
            }
          }
        },
        series: series.map(seriesItem => ({
          name: seriesItem.name,
          type: 'line',
          data: lineData.map(item => Number(item[seriesItem.key])),
          smooth: true,
          lineStyle: {
            color: resolveColor(seriesItem.color, 0),
            width: 3
          },
          itemStyle: {
            color: resolveColor(seriesItem.color, 0)
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: resolveColor(seriesItem.color, 0) + '40' },
              { offset: 1, color: resolveColor(seriesItem.color, 0) + '10' }
            ])
          }
        }))
      }
    }

    if (type === 'pie') {
      const chartData = data as ChartDataPoint[]
      
      return {
        ...baseOption,
        tooltip: {
          trigger: 'item',
          formatter: (params: any) => {
            const value = currencySymbol 
              ? `${currencySymbol}${params.value.toLocaleString()}` 
              : params.value.toLocaleString();
            return `${params.name}: ${value} (${params.percent}%)`;
          },
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderColor: '#e5e7eb',
          textStyle: {
            color: '#374151'
          }
        },
        legend: {
          orient: 'vertical',
          right: '10%',
          top: 'center',
          data: chartData.map(item => item.label)
        },
        series: [{
          name: title,
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['40%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 8,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: 'bold'
            }
          },
          labelLine: {
            show: false
          },
          data: chartData.map((item, index) => ({
            value: item.value,
            name: item.label,
            itemStyle: {
              color: resolveColor(item.color, index)
            }
          }))
        }]
      }
    }

    // Default bar chart
    const chartData = data as ChartDataPoint[]
    
    return {
      ...baseOption,
      tooltip: {
        ...baseOption.tooltip,
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        }
      },
      xAxis: {
        type: 'category',
        data: chartData.map(item => item.label),
        axisLine: {
          lineStyle: {
            color: '#d1d5db'
          }
        },
        axisLabel: {
          color: '#6b7280'
        }
      },
      yAxis: {
        type: 'value',
        axisLine: {
          lineStyle: {
            color: '#d1d5db'
          }
        },
        axisLabel: {
          color: '#6b7280'
        },
        splitLine: {
          lineStyle: {
            color: '#f3f4f6'
          }
        }
      },
      series: [{
        data: chartData.map((item, index) => ({
          value: item.value,
          name: item.label,
          itemStyle: {
            color: resolveColor(item.color, index)
          }
        })),
        type: 'bar',
        barWidth: '60%',
        itemStyle: {
          borderRadius: [4, 4, 0, 0]
        }
      }]
    }
  }

  const classes = `${noPadding ? '' : 'p-6'} ${className}`;

  return (
    <div className={classes}>
      <ReactECharts
        option={getOption()}
        style={{ height: height, width: '100%' }}
        theme={theme}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  )
});

export default Chart;
