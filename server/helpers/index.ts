export const normalizeField = (value: any): string[] => {
    if (!value) return [];

    let normalizedValue;
    if (Array.isArray(value)) {
        normalizedValue = value;
    } else {
        try {
            normalizedValue = JSON.parse(value);
        } catch {
            normalizedValue = value
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean);
        }
    }
    return normalizedValue;
};

