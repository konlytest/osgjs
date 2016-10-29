'use strict';
var Map = require( 'osg/Map' );
var Notify = require( 'osg/notify' );
var Texture = require( 'osg/Texture' );
var Uniform = require( 'osg/Uniform' );
var MACROUTILS = require( 'osg/Utils' );
var vec4 = require( 'osg/glMatrix' ).vec4;


/**
 * ShadowTexture Attribute encapsulate Texture webgl object
 * with Shadow specificities (no need of texcoord,fragtexcoord)
 * trigger hash change when changing texture precision from float to byt
 * shadowSettings.js header for param explanations
 * @class ShadowTexture
 * @inherits StateAttribute
 */
var ShadowTextureAtlas = function () {

    Texture.call( this );
    this._uniforms = {};
    this._mapSize = vec4.create();
    this._lightUnitStart = -1; // default for a valid cloneType
    this._lightNumber = 0;

    this._viewMatrices = [];
    this._projMatrices = [];
    this._DepthRanges = [];
    this._MapSizes = [];

};

ShadowTextureAtlas.uniforms = {};
/** @lends Texture.prototype */
ShadowTextureAtlas.prototype = MACROUTILS.objectLibraryClass( MACROUTILS.objectInherit( Texture.prototype, {

    cloneType: function () {
        return new ShadowTextureAtlas();
    },

    setLightNumber( value ) {

        this._lightNumber = value;

        this._viewMatrices.length = value;
        this._projMatrices = value;
        this._DepthRanges = value;
        this._MapSizes = value;

    },

    getLightNumber() {

        return this._lightNumber;

    },

    setLightUnitStart: function ( lun ) {

        this._lightUnitStart = lun;

    },
    getLightUnitStart: function () {

        return this._lightUnitStart;

    },

    getUniformName: function ( name, lightNumber ) {

        var prefix = 'Shadow_' + this.getType() + this._lightUnitStart.toString();
        if ( lightNumber !== undefined ) prefix += '_' + lightNumber;
        return 'u' + prefix + '_' + name;

    },

    getVaryingName: function ( name, lightNumber ) {

        var prefix = this.getType() + ( this._lightUnit + lightNumber ).toString();
        return 'v' + prefix + '_' + name;

    },

    getOrCreateUniforms: function ( unit ) {

        // uniform are once per CLASS attribute, not per instance
        var obj = ShadowTextureAtlas;
        console.assert( unit !== undefined );
        Notify.assert( this._lightUnit !== -1 );

        if ( obj.uniforms[ unit ] !== undefined ) return obj.uniforms[ unit ];

        var uniforms = {};

        for ( var i = 0; i < this._lightNumber; i++ ) {

            uniforms[ 'ViewMatrix' + i ] = Uniform.createMat4( this.getUniformName( 'viewMatrix', i ) );
            uniforms[ 'ProjectionMatrix' + i ] = Uniform.createMat4( this.getUniformName( 'projectionMatrix', i ) );
            uniforms[ 'DepthRange' + i ] = Uniform.createFloat4( this.getUniformName( 'depthRange', i ) );
            uniforms[ 'MapSize' + i ] = Uniform.createFloat4( this.getUniformName( 'mapSize', i ) ); // TODO remove

        }

        // shadowmapsize always the same, used for texel space
        // shared by all shadowmap
        uniforms[ 'texelSize' ] = Uniform.createFloat4( this.getUniformName( 'texelSize' ) );
        uniforms[ 'renderSize' ] = Uniform.createFloat2( this.getUniformName( 'renderSize' ) );

        // Dual Uniform of texture, needs:
        // - Sampler (type of texture)
        // - Int (texture unit)
        // tells Shader Program where to find it
        var name = 'Texture' + unit;
        var uniform = Uniform.createInt1( unit, name );
        uniforms[ name ] = uniform;

        // Per Class Uniform Cache
        obj.uniforms[ unit ] = new Map( uniforms );

        return obj.uniforms[ unit ];
    },

    setViewMatrix: function ( viewMatrix, lightNumber ) {
        this._viewMatrices[ lightNumber ] = viewMatrix;
    },

    setProjectionMatrix: function ( projectionMatrix, lightNumber ) {
        this._projectionMatrices[ lightNumber ] = projectionMatrix;
    },

    setDepthRange: function ( depthRange, lightNumber ) {
        this._depthRanges[ lightNumber ] = depthRange;
    },

    setTextureSize: function ( w, h ) {

        Texture.prototype.setTextureSize.call( this, w, h );
        this.dirty();

    },

    setMapSize: function ( w, h, lightNumber ) {

        var mapSize = vec4.create();

        mapSize[ 0 ] = w;
        mapSize[ 1 ] = h;
        mapSize[ 2 ] = 1.0 / w;
        mapSize[ 3 ] = 1.0 / h;

        this._mapSizes[ lightNumber ] = mapSize;

    },

    apply: function ( state, texUnit ) {

        // Texture stuff: call parent class method
        Texture.prototype.apply.call( this, state, texUnit );

        if ( this._lightUnit === -1 )
            return;

        // update Uniforms
        var uniformMap = this.getOrCreateUniforms( texUnit );

        for ( var i = 0; i < this._lightNumber; i++ ) {

            uniformMap[ 'ViewMatrix' + i ].setMatrix4( this._viewMatrices[ i ] );
            uniformMap[ 'ProjectionMatrix' + i ].setMatrix4( this._projectionMatrices[ i ] );
            uniformMap[ 'DepthRange' + i ].setFloat4( this._depthRanges[ i ] );
            uniformMap[ 'MapSize' + i ].setFloat4( this._mapSizes[ i ] );

        }

    },

    getHash: function () {
        return this.getTypeMember() + '_' + this._lightUnitStart + '_' + this._lightNumber + '_' + this._type;
    }

} ), 'osgShadow', 'ShadowTextureAtlas' );

MACROUTILS.setTypeID( ShadowTextureAtlas );

module.exports = ShadowTextureAtlas;
