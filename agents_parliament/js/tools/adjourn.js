/**
 * parliament-adjourn tool - Adjourn the House and end the session
 */
export function toolAdjourn(session, args) {
    const reason = args.length > 0 ? args.join(' ').replace(/"/g, '') : 'Business concluded';
    
    session.state.adjourned = true;
    session.state.stage = 'Adjourned';
    
    const entry = session.addToHansard('Speaker', `The House stands adjourned. ${reason}`);
    
    return {
        status: 'success',
        message: 'House adjourned',
        data: {
            reason,
            timestamp: entry.timestamp
        },
        exitCode: 0
    };
}

