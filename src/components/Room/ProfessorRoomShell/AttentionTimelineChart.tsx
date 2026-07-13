import React from 'react';
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, Tooltip } from 'recharts';
import { AttentionTimelinePoint } from '../../AttentionProvider/types';
import { attentionStatusColors } from '../../../theme';

interface AttentionTimelineChartProps {
  timeline: AttentionTimelinePoint[];
  attentionThreshold: number;
}

/**
 * The Grupo-tab "Evolución temporal" area chart, extracted into its own leaf module
 * so it is the ONLY recharts importer on the professor room path. ProfessorRightRail
 * loads it via React.lazy, keeping recharts (and its d3 dependency tree) out of the
 * main bundle. Keep this module free of other imports that live in the main chunk.
 */
export default function AttentionTimelineChart({ timeline, attentionThreshold }: AttentionTimelineChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={timeline} margin={{ top: 4, right: 4, left: -24, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2ecf9" />
        <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#94a3b8' }} minTickGap={40} interval="preserveStartEnd" />
        <YAxis domain={[0, 100]} tick={{ fontSize: 8, fill: '#94a3b8' }} />
        <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #e2ecf9' }} />
        <ReferenceLine
          y={attentionThreshold}
          stroke={attentionStatusColors.medium}
          strokeDasharray="4 4"
          strokeWidth={1}
          strokeOpacity={0.5}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#1d6eed"
          strokeWidth={2}
          fill="#1d6eed"
          fillOpacity={0.1}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
