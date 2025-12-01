/**
 * parliament-share tool - Share a file or document with the House
 */
export function toolShare(session, args) {
    if (args.length < 2) {
        return { status: 'error', message: 'Invalid format. Usage: parliament-share [name] [file content]', exitCode: 1 };
    }

    // Extract name (first arg, remove quotes if present)
    const name = args[0].replace(/"/g, '');
    
    // Extract file content (everything after the name, handling quotes like other tools)
    const contentMatch = args.slice(1).join(' ').match(/"([^"]*)"/);
    const content = contentMatch ? contentMatch[1] : args.slice(1).join(' ');

    const paper = {
        id: `PAPER-${session.papers.length + 1}`,
        filename: name,
        description: `Shared document: ${name}`,
        content: content
    };

    session.papers.push(paper);

    return {
        status: 'success',
        message: `Shared: ${name}`,
        data: paper,
        exitCode: 0
    };
}

