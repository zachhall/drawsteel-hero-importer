/** Minimal types for the JSON Canvas format (https://jsoncanvas.org/) that Obsidian's Canvas core plugin reads. */

export interface CanvasTextNode {
	id: string;
	type: "text";
	x: number;
	y: number;
	width: number;
	height: number;
	text: string;
	color?: string;
}

export interface CanvasGroupNode {
	id: string;
	type: "group";
	x: number;
	y: number;
	width: number;
	height: number;
	label?: string;
	color?: string;
}

export type CanvasNode = CanvasTextNode | CanvasGroupNode;

export interface CanvasData {
	nodes: CanvasNode[];
	edges: never[];
}
