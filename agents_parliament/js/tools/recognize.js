/**
 * parliament-recognize tool - Grant the floor to a Member or all Members
 */
export function toolRecognize(session, args) {
    if (args.length < 1) {
        return { status: 'error', message: 'Invalid format. Usage: parliament-recognize [all|member-number] [instruction]', exitCode: 1 };
    }

    const target = args[0].toLowerCase();
    const instruction = args.slice(1).join(' ').replace(/"/g, '');

    // Validate target
    if (target !== 'all' && !/^\d+$/.test(target)) {
        return { status: 'error', message: 'Target must be "all" or a member number', exitCode: 1 };
    }

    const memberNumber = target === 'all' ? null : parseInt(target);

    return {
        status: 'success',
        message: `Recognizing ${target === 'all' ? 'all members' : `Member ${memberNumber}`}`,
        data: {
            target: target === 'all' ? 'all' : memberNumber,
            instruction: instruction || '',
            requiresInvocation: true  // Flag for index.js to trigger LLM call
        },
        exitCode: 0
    };
}

