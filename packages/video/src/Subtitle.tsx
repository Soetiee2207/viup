import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {stickerText} from './Scene';
import type {Word} from './types';

// Phụ đề kiểu Shorts: hiện nhóm từ của beat hiện tại, tô vàng đúng từ đang đọc (mốc WordBoundary)
// Video kể chuyện: phụ đề nằm trong khung màu theo người nói (cua: tím đậm, khách: đỏ) + bảng tên của khách
export const Subtitle: React.FC<{words: Word[]; startFrame: number; who?: 'crab' | 'guest'; name?: string; story?: boolean}> = ({
	words,
	startFrame,
	who = 'crab',
	name,
	story = false,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const t = frame / fps;
	const pop = spring({frame: frame - startFrame, fps, config: {damping: 12, stiffness: 220}});

	const box: React.CSSProperties = story
		? {
				background: who === 'guest' ? '#e03131' : '#3b2a7a',
				border: '8px solid #1b1430',
				borderRadius: 34,
				padding: '18px 26px 22px',
				boxShadow: '0 12px 0 #1b1430',
				WebkitTextStroke: '10px #1b1430',
			}
		: {};
	return (
		<div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
			{story && name && who === 'guest' && (
				<div
					style={{
						...stickerText,
						fontSize: 44,
						WebkitTextStroke: '0px',
						background: '#ffd43b',
						color: '#1b1430',
						border: '6px solid #1b1430',
						borderRadius: 20,
						padding: '4px 22px',
						marginBottom: -14,
						zIndex: 1,
						transform: `rotate(-3deg) scale(${pop})`,
					}}
				>
					{name}
				</div>
			)}
		<div
			style={{
				...stickerText,
				...box,
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
		</div>
	);
};
