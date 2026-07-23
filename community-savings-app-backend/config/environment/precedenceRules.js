/**
 * TITech Community Capital LTD
 * Enterprise environment precedence rules.
 *
 * Lowest priority first.
 * Highest priority last.
 */

const DEFAULT_PRECEDENCE = [
    ".env",
    ".env.local",
    ".env.{environment}",
    ".env.{environment}.local"
];


function resolvePrecedence(environment) {

    return DEFAULT_PRECEDENCE.map(
        layer =>
            layer.replace(
                "{environment}",
                environment
            )
    );
}


module.exports = {
    DEFAULT_PRECEDENCE,
    resolvePrecedence
};