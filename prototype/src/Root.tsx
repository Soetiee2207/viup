import React from 'react';
import {Composition, staticFile} from 'remotion';
import {Short, shortSchema} from './Short';
import type {Manifest} from './types';

export const RemotionRoot: React.FC = () => (
	<Composition
		id="Short"
		component={Short}
		schema={shortSchema}
		// Nút "Save" trong Remotion Studio ghi đè trực tiếp các giá trị này
		defaultProps={{
			characterImage: '',
			characterWidth: 620,
			face: {
				eyeLeftX: 0.38,
				eyeRightX: 0.62,
				eyeY: 0.4,
				eyeSize: 0.09,
				mouthX: 0.5,
				mouthY: 0.53,
				mouthWidth: 0.16,
				color: '#2b2140',
			},
			backgroundImage: '',
			backgroundTop: '#7fd3f7',
			backgroundBottom: '#2f6fd6',
		}}
		width={1080}
		height={1920}
		fps={30}
		durationInFrames={300}
		calculateMetadata={async ({props}) => {
			const res = await fetch(staticFile('manifest.json'));
			if (!res.ok) throw new Error('Chưa có public/manifest.json — hãy chạy "npm run voice" trước');
			const manifest = (await res.json()) as Manifest;
			return {
				fps: manifest.fps,
				// Giữ thêm 0.8s cuối để video không bị cắt cụt
				durationInFrames: Math.ceil((manifest.duration + 0.8) * manifest.fps),
				props: {...props, manifest},
			};
		}}
	/>
);
