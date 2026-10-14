import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/google-fonts/BeVietnamPro';
import type {Line} from './types';

const {fontFamily} = loadFont('normal', {weights: ['800'], subsets: ['vietnamese', 'latin']});

// Phụ đề kiểu Shorts: hiện cả câu, tô vàng từ đang được đọc
export const Subtitle: React.FC<{line: Line; lineFrame: number}> = ({line, lineFrame}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const t = frame / fps;
	const words = line.text.split(/\s+/);
	const total = words.reduce((n, w) => n + w.length, 0);
	// Ước lượng từ đang đọc theo tỉ lệ số ký tự
	const spoken = Math.max(0, Math.min(1, (t - line.start) / (line.end - line.start))) * total;
	const pop = spring({frame: lineFrame, fps, config: {damping: 12, stiffness: 200}});

	let seen = 0;
	return (
		<div
			style={{
				fontFamily,
				fontWeight: 800,
				fontSize: 62,
				lineHeight: 1.25,
				textAlign: 'center',
				color: 'white',
				WebkitTextStroke: '14px #1b1430',
				paintOrder: 'stroke fill',
				transform: `scale(${0.85 + 0.15 * pop})`,
				opacity: pop,
			}}
		>
			{words.map((word, i) => {
				const from = seen;
				seen += word.length;
				const active = spoken >= from && spoken < seen && t <= line.end;
				return (
					<span
						key={i}
						style={{
							display: 'inline-block',
							margin: '0 10px',
							color: active ? '#ffd43b' : 'white',
							transform: active ? 'scale(1.12)' : undefined,
						}}
					>
						{word}
					</span>
				);
			})}
		</div>
	);
};
