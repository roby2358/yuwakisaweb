/**
 * parliament-edit tool - View files, propose amendments, or enact approved changes
 */
export function toolEdit(session, args) {
    const mode = args.find(a => a.startsWith('--'));

    if (mode === '--view') {
        const filename = args[0];
        const content = session.files[filename];
        if (!content) {
            return { status: 'error', message: 'File not found', exitCode: 4 };
        }
        return {
            status: 'success',
            message: `Viewing ${filename}`,
            data: { filename, content },
            exitCode: 0
        };
    } else if (mode === '--propose') {
        const filename = args[0];
        // Extract diff from quotes or backticks (handle multi-line)
        const fullArgs = args.join(' ');
        // Try backticks first (triple or more)
        let diffMatch = fullArgs.match(/```+([\s\S]*?)```+/);
        if (!diffMatch) {
            // Fallback to quotes
            diffMatch = fullArgs.match(/"([\s\S]*?)"/);
        }
        const diff = diffMatch ? diffMatch[1] : '';

        const amendment = {
            id: `AMDT-${session.nextAmendmentId++}`,
            file: filename,
            diff,
            tabled: false,
            passed: false,
            created: new Date().toISOString()
        };

        session.amendments.push(amendment);

        return {
            status: 'success',
            message: `Amendment ${amendment.id} created`,
            data: amendment,
            exitCode: 0
        };
    } else if (mode === '--enact') {
        const amendmentId = args.find(a => a.startsWith('AMDT-'));
        const amendment = session.amendments.find(a => a.id === amendmentId);

        if (!amendment) {
            return { status: 'error', message: 'Amendment not found', exitCode: 4 };
        }

        if (!amendment.passed) {
            return { status: 'error', message: 'Amendment not passed', exitCode: 2 };
        }

        // Apply the diff (simple string replacement for now)
        const [from, to] = amendment.diff.split('->').map(s => s.trim());
        if (session.files[amendment.file]) {
            session.files[amendment.file] = session.files[amendment.file].replace(from, to);
        }

        return {
            status: 'success',
            message: `Amendment ${amendmentId} enacted`,
            data: { file: amendment.file },
            exitCode: 0
        };
    } else if (mode === '--view-amendment') {
        const amendmentId = args.find(a => a.startsWith('AMDT-'));
        const amendment = session.amendments.find(a => a.id === amendmentId);

        if (!amendment) {
            return { status: 'error', message: 'Amendment not found', exitCode: 4 };
        }

        return {
            status: 'success',
            message: `Viewing amendment ${amendmentId}`,
            data: amendment,
            exitCode: 0
        };
    } else if (mode === '--create') {
        const filename = args[0];
        if (!filename) {
            return { status: 'error', message: 'Filename required', exitCode: 1 };
        }

        // Extract content from quotes or backticks (handle multi-line)
        // First, try to find a quoted string argument
        let content = '';
        const quotedArg = args.find(arg => 
            (arg.startsWith('"') && arg.endsWith('"')) || 
            (arg.startsWith("'") && arg.endsWith("'")) ||
            (arg.startsWith('```') && arg.endsWith('```'))
        );
        if (quotedArg) {
            if (quotedArg.startsWith('```')) {
                // Extract content from backtick-delimited string (remove backticks)
                // Find the number of backticks at the start
                const backtickCount = quotedArg.match(/^`+/)[0].length;
                content = quotedArg.slice(backtickCount, -backtickCount);
            } else {
                // Extract content from quoted string (remove quotes)
                content = quotedArg.slice(1, -1);
            }
        } else {
            // Fallback: try regex on joined args (for multi-line strings that span args)
            const fullArgs = args.join(' ');
            // Try backticks first (triple or more)
            let contentMatch = fullArgs.match(/```+([\s\S]*?)```+/);
            if (!contentMatch) {
                // Fallback to quotes
                contentMatch = fullArgs.match(/"([\s\S]*?)"/);
            }
            content = contentMatch ? contentMatch[1] : '';
        }

        // Check if file already exists
        if (session.files[filename]) {
            return { status: 'error', message: 'File already exists. Use --propose to amend it.', exitCode: 2 };
        }

        // Create the file
        session.files[filename] = content;

        return {
            status: 'success',
            message: `File ${filename} created`,
            data: { filename, content },
            exitCode: 0
        };
    }

    return { status: 'error', message: 'Invalid mode', exitCode: 1 };
}

