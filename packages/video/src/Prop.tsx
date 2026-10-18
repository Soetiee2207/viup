import React from 'react';
import {Img, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {browFor, Eye, eyeOpenFor, type Face, Mouth, useBlink} from './Character';
import type {Emotion} from './types';

// Vị trí mặt trên từng icon (tỉ lệ 0..1 theo kích thước icon). Icon không có trong bảng dùng DEFAULT_FACE.
// Chỉnh: render still (npm run stills) rồi sửa số ở đây.
type FaceSpot = {x: number; y: number; gap: number; eye: number; mouth: number};
const DEFAULT_FACE: FaceSpot = {x: 0.5, y: 0.46, gap: 0.13, eye: 0.085, mouth: 0.15};
const FACES: Record<string, Partial<FaceSpot>> = {
	'anatomical-heart': {x: 0.47, y: 0.58, gap: 0.12},
	'red-heart': {y: 0.42},
	'blue-heart': {y: 0.42},
	'yellow-heart': {y: 0.42},
	'green-heart': {y: 0.42},
	'purple-heart': {y: 0.42},
	droplet: {y: 0.6, gap: 0.11, eye: 0.075, mouth: 0.13},
	lungs: {y: 0.55, gap: 0.2},
	coin: {y: 0.45},
	bell: {y: 0.5},
	'water-wave': {x: 0.55, y: 0.6, gap: 0.1},
	'atom-symbol': {y: 0.45, gap: 0.1, eye: 0.07, mouth: 0.12},
	'light-bulb': {y: 0.36, gap: 0.12},
	'alarm-clock': {y: 0.5},
	'money-bag': {y: 0.62},
	brain: {y: 0.48},
	tooth: {y: 0.36},
	cucumber: {x: 0.45, y: 0.5, gap: 0.09, eye: 0.07, mouth: 0.11},
};

const faceFor = (icon: string): Face => {
	const s = {...DEFAULT_FACE, ...FACES[icon]};
	return {
		eyeLeftX: s.x - s.gap,
		eyeRightX: s.x + s.gap,
		eyeY: s.y,
		eyeSize: s.eye,
		mouthX: s.x,
		mouthY: s.y + s.eye * 1.6,
		mouthWidth: s.mouth,
		color: '#1d1212',
	};
};

type Props = {
	icon: string;
	size: number;
	face: boolean;
	emotion: Emotion;
	talk: number; // 0..1 khi đồ vật đang là "người nói", 0 khi im lặng
	enter: number; // khung hình kể từ lúc icon bật vào (âm = chưa xuất hiện)
	seed: string;
	style?: React.CSSProperties;
};

// Icon minh hoạ biết biểu cảm: bật vào, lơ lửng, co giãn theo giọng, chớp mắt, nhép miệng
export const TalkingProp: React.FC<Props> = ({icon, size, face, emotion, talk, enter, seed, style}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const blinking = useBlink(seed);
	const t = frame / fps;
	const phase = seed.length * 1.7;
	const pop = spring({frame: enter, fps, config: {damping: 9, stiffness: 170}});
	const float = Math.sin(t * 2.4 + phase) * size * 0.025;
	const wobble = emotion === 'vui' ? Math.sin(t * 6 + phase) * 5 : Math.sin(t * 1.8 + phase) * 2;
	// Icon có sẵn mặt (con vật) không nhép miệng được -> nhún mạnh hơn khi nói
	const squash = 1 + talk * (face ? 0.06 : 0.16);
	const f = faceFor(icon);

	return (
		<div
			style={{
				position: 'relative',
				width: size,
				height: size,
				transform: `translateY(${float}px) rotate(${wobble + (1 - pop) * -25}deg) scale(${pop / squash ** 0.5}, ${pop * squash})`,
				transformOrigin: '50% 90%',
				...style,
			}}
		>
			<Img src={staticFile(`icons/${icon}.svg`)} style={{width: size, height: size, display: 'block'}} />
			{face && (
				<>
					<Eye
						x={f.eyeLeftX}
						y={f.eyeY}
						size={f.eyeSize * size}
						open={eyeOpenFor(emotion, blinking)}
						color={f.color}
						brow={browFor(emotion)}
						side={1}
					/>
					<Eye
						x={f.eyeRightX}
						y={f.eyeY}
						size={f.eyeSize * size}
						open={eyeOpenFor(emotion, blinking)}
						color={f.color}
						brow={browFor(emotion)}
						side={-1}
					/>
					<Mouth face={f} width={size} talk={talk} emotion={emotion} />
				</>
			)}
		</div>
	);
};
