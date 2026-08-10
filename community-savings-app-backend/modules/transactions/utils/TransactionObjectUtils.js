'use strict';

/**
 * ============================================================================
 * TITech Community Capital Ltd
 * Transaction Object Utilities
 * ============================================================================
 *
 * Provides:
 *
 * - deepFreeze()
 * - deepClone()
 * - isPlainObject()
 * - immutable configuration helpers
 *
 * Design goals:
 *
 * - Prevent accidental mutation
 * - Protect runtime configuration
 * - Safely clone event payloads
 * - Support distributed transaction reliability
 *
 * ============================================================================
 */



/**
 * ============================================================================
 * Check Plain Object
 * ============================================================================
 *
 * Determines whether a value is a normal object.
 *
 * Excludes:
 *
 * - Arrays
 * - Dates
 * - Maps
 * - Sets
 * - Class instances
 * - Buffers
 *
 */


function isPlainObject(value) {


    if (

        value === null ||

        typeof value !== 'object'

    ) {


        return false;


    }



    const prototype =

        Object.getPrototypeOf(value);



    return (

        prototype === Object.prototype ||

        prototype === null

    );


}





/**
 * ============================================================================
 * Deep Freeze Object
 * ============================================================================
 *
 * Recursively freezes:
 *
 * - Objects
 * - Arrays
 *
 * Used for:
 *
 * - Constants
 * - Configuration
 * - Immutable metadata
 *
 */


function deepFreeze(object) {


    if (

        object === null ||

        typeof object !== 'object'

    ) {


        return object;


    }



    Object.freeze(object);



    Object.getOwnPropertyNames(object)

        .forEach(

            property => {


                const value =

                    object[property];



                if (

                    value &&

                    typeof value === 'object' &&

                    !Object.isFrozen(value)

                ) {


                    deepFreeze(value);


                }


            }

        );



    return object;


}





/**
 * ============================================================================
 * Deep Clone
 * ============================================================================
 *
 * Safely clones transaction objects.
 *
 * Supports:
 *
 * - Objects
 * - Arrays
 * - Dates
 * - Maps
 * - Sets
 *
 */


function deepClone(value, seen = new WeakMap()) {


    if (

        value === null ||

        typeof value !== 'object'

    ) {


        return value;


    }



    if (

        seen.has(value)

    ) {


        return seen.get(value);


    }



    if (

        value instanceof Date

    ) {


        return new Date(

            value.getTime()

        );


    }



    if (

        value instanceof Map

    ) {


        const clone =

            new Map();



        seen.set(

            value,

            clone

        );



        value.forEach(

            (item, key) => {


                clone.set(

                    deepClone(key, seen),

                    deepClone(item, seen)

                );


            }

        );



        return clone;


    }



    if (

        value instanceof Set

    ) {


        const clone =

            new Set();



        seen.set(

            value,

            clone

        );



        value.forEach(

            item => {


                clone.add(

                    deepClone(item, seen)

                );


            }

        );



        return clone;


    }



    if (

        Array.isArray(value)

    ) {


        const clone = [];



        seen.set(

            value,

            clone

        );



        value.forEach(

            item => {


                clone.push(

                    deepClone(item, seen)

                );


            }

        );



        return clone;


    }



    const clone =

        Object.create(

            Object.getPrototypeOf(value)

        );



    seen.set(

        value,

        clone

    );



    Reflect.ownKeys(value)

        .forEach(

            key => {


                clone[key] =

                    deepClone(

                        value[key],

                        seen

                    );


            }

        );



    return clone;


}





/**
 * ============================================================================
 * Create Immutable Configuration
 * ============================================================================
 *
 * Creates a protected runtime configuration snapshot.
 *
 */


function createImmutableConfig(configuration = {}) {


    const clone =

        deepClone(

            configuration

        );



    return deepFreeze(

        clone

    );


}





/**
 * ============================================================================
 * Merge Immutable Configuration
 * ============================================================================
 *
 * Creates a new configuration object.
 *
 * Original objects remain untouched.
 *
 */


function mergeImmutableConfig(
    base = {},
    override = {}
) {


    const merged =

        mergeObjects(

            deepClone(base),

            override

        );



    return deepFreeze(

        merged

    );


}





/**
 * ============================================================================
 * Recursive Object Merge
 * ============================================================================
 */


function mergeObjects(
    target,
    source
) {


    if (

        !isPlainObject(source)

    ) {


        return target;


    }



    Object.keys(source)

        .forEach(

            key => {


                const value =

                    source[key];



                if (

                    isPlainObject(value)

                    &&

                    isPlainObject(target[key])

                ) {


                    target[key] =

                        mergeObjects(

                            target[key],

                            value

                        );


                }

                else {


                    target[key] =

                        deepClone(value);


                }


            }

        );



    return target;


}





/**
 * ============================================================================
 * Check Immutable
 * ============================================================================
 */


function isImmutable(value) {


    return Object.isFrozen(

        value

    );


}





/**
 * ============================================================================
 * Export
 * ============================================================================
 */


module.exports = {


    isPlainObject,


    deepFreeze,


    deepClone,


    createImmutableConfig,


    mergeImmutableConfig,


    isImmutable


};