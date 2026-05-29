export function validateActivity(input) {
    const errors = [];
    const trimmedLength = input.description.trim().length;
    if (trimmedLength === 0) {
        errors.push({ field: 'description', code: 'required' });
    }
    else if (trimmedLength > 1024) {
        errors.push({ field: 'description', code: 'too_long' });
    }
    if (input.allDay === false && input.endTime <= input.startTime) {
        errors.push({ field: 'time', code: 'end_before_or_equal_start' });
    }
    if (errors.length > 0) {
        return { ok: false, errors };
    }
    return { ok: true, value: input };
}
//# sourceMappingURL=validation.js.map