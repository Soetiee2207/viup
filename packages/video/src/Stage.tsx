import React from 'react';
import {Img, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/google-fonts/BeVietnamPro';
import type {Line} from './types';

const {fontFamily} = loadFont('normal', {weights: ['800'], subsets: ['vietnamese', 'latin']});

const MAX_ITEMS = 6;
const SIZE_BY_COUNT = [0, 480, 360, 280, 240, 220, 200];

// Bảng minh hoạ phía trên: icon bật vào lần lượt rồi lơ lửng, kèm nhãn chữ to
export const Stage: React.FC<{line: Line; visualFrame: number}> = ({line, visualFrame}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const items = line.props.flatMap((p) => Array.from({length: p.count}, () => p.icon)).slice(0, MAX_ITEMS);
	const size = SIZE_BY_COUNT[items.length] ?? 210;
	const labelIn = spring({frame: visualFrame - items.length * 4 - 4, fps, config: {damping: 12, stiffness: 180}});

	return (
		<div
			style={{
				position: 'absolute',
				left: 70,
				right: 70,
				top: 140,
				height: 740,
				borderRadius: 56,
				background: 'rgba(255,255,255,0.92)',
				border: '10px solid #1b1430',
				boxShadow: '0 24px 0 rgba(27,20,48,0.25)',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				gap: 30,
				overflow: 'hidden',
			}}
		>
			<div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 24, maxWidth: 860}}>
				{items.map((icon, i) => {
					const pop = spring({frame: visualFrame - i * 4, fps, config: {damping: 9, stiffness: 160}});
					const float = Math.sin((frame / fps) * 2.2 + i * 1.3) * 10;
					return (
						<Img
							key={i}
							src={staticFile(`icons/${icon}.svg`)}
							style={{
								width: size,
								height: size,
								transform: `translateY(${float}px) scale(${pop}) rotate(${(1 - pop) * -20}deg)`,
							}}
						/>
					);
				})}
			</div>
			{line.label && (
				<div
					style={{
						fontFamily,
						fontWeight: 800,
						fontSize: 72,
						color: 'white',
						background: '#e8563a',
						padding: '10px 36px',
						borderRadius: 999,
						transform: `scale(${labelIn})`,
					}}
				>
					{line.label}
				</div>
			)}
		</div>
	);
};
