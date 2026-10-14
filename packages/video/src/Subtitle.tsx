import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {stickerText} from './Scene';
import type {Word} from './types';

// Phụ đề kiểu Shorts: hiện nhóm từ của beat hiện tại, tô vàng đúng từ đang đọc (mốc WordBoundary)
export const Subtitle: React.FC<{words: Word[]; startFrame: number}> = ({words, startFrame}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const t = frame / fps;
	const pop = spring({frame: frame - startFrame, fps, config: {damping: 12, stiffness: 220}});

	return (
		<div
			style={{
				...stickerText,
				fontSize: 72,
				lineHeight: 1.25,
				transform: `scale(${0.8 + 0.2 * pop})`,
				opacity: pop,
			}}
		>
			{words.map((w, i) => {
				const active = t >= w.start && t < w.end;
				return (
					<span
						key={i}
						style={{
							display: 'inline-block',
							margin: '0 10px',
							color: active ? '#ffd43b' : 'white',
							transform: active ? 'scale(1.15) translateY(-4px)' : undefined,
						}}
					>
						{w.text}
					</span>
				);
			})}
		</div>
	);
};
