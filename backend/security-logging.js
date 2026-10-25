function getRejectedApiRequestLogMessage(apiKey) {
    return `Rejecting request - invalid API use for protected endpoint. API key provided: ${Boolean(apiKey)}`;
}

function getDownloaderInvocationLogMessage() {
    return 'Downloader invocation prepared.';
}

function getArgumentInjectionFailureLogMessage() {
    return 'Failed to apply downloader arguments.';
}

module.exports = {
    getArgumentInjectionFailureLogMessage,
    getDownloaderInvocationLogMessage,
    getRejectedApiRequestLogMessage
};
