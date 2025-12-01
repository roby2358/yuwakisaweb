/**
 * parliament-order-paper tool - Display the current business of the House
 */
export function toolOrderPaper(session) {
    return {
        status: 'success',
        message: 'Order Paper',
        data: {
            stage: session.state.stage,
            currentBill: session.state.currentBill,
            activeMotion: session.state.activeMotion,
            voting: session.state.voting
        },
        exitCode: 0
    };
}

