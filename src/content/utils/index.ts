export function getDatetime(takenAt: number) {
	return new Date(takenAt).toISOString();
}
