export type Emotion = 'vui' | 'buon' | 'ngacnhien' | 'binhthuong';

export type Line = {
	text: string;
	emotion: Emotion;
	start: number;
	end: number;
};

// Sinh ra bởi tools/make_voice.py
export type Manifest = {
	fps: number;
	duration: number;
	lines: Line[];
	envelope: number[];
};
