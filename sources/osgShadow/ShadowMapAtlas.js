'use strict';
var Camera = require( 'osg/Camera' );
var CullVisitor = require( 'osg/CullVisitor' );
var BlendFunc = require( 'osg/BlendFunc' );
var ComputeBoundsVisitor = require( 'osg/ComputeBoundsVisitor' );
var Depth = require( 'osg/Depth' );
var FrameBufferObject = require( 'osg/FrameBufferObject' );
var mat4 = require( 'osg/glMatrix' ).mat4;
var MatrixTransform = require( 'osg/MatrixTransform' );
var Notify = require( 'osg/notify' );
var Shape = require( 'osg/shape' );
var StateAttribute = require( 'osg/StateAttribute' );
var StateSet = require( 'osg/StateSet' );
var Debug = require( 'osgUtil/debug' );
var Texture = require( 'osg/Texture' );
var Transform = require( 'osg/Transform' );
var Uniform = require( 'osg/Uniform' );
var MACROUTILS = require( 'osg/Utils' );
var PrimitiveSet = require( 'osg/primitiveSet' );
var vec3 = require( 'osg/glMatrix' ).vec3;
var vec4 = require( 'osg/glMatrix' ).vec4;
var Viewport = require( 'osg/Viewport' );
var WebGLCaps = require( 'osg/WebGLCaps' );
var ShadowReceiveAttribute = require( 'osgShadow/ShadowReceiveAttribute' );
var ShadowCasterVisitor = require( 'osgShadow/ShadowCasterVisitor' );
var ShadowFrustumIntersection = require( 'osgShadow/ShadowFrustumIntersection' );
var ShadowCastAttribute = require( 'osgShadow/ShadowCastAttribute' );
var ShadowTechnique = require( 'osgShadow/ShadowTechnique' );
var ShadowTextureAtlas = require( 'osgShadow/ShadowTextureAtlas' );
var ShadowMap = require( 'osgShadow/ShadowMap' );

/**
 *  ShadowMapAtlas provides an implementation of shadow textures.
 * here, one shadow
 *  @class ShadowMapAtlas
 */
var ShadowMapAtlas = function ( settings ) {

    ShadowTechnique.call( this );


    this._texture = new ShadowTextureAtlas();
    this._textureUnitBase = 4;
    this._textureUnit = this._textureUnitBase;

    // see shadowSettings.js header for param explanations
    this._textureMagFilter = undefined;
    this._textureMinFilter = undefined;

    this._textureSize = 1024;
    this._shadowMapSize = 256;

    this._receivingStateset = undefined;

    this._texelSizeUniform = Uniform.createFloat1( 1.0 / this._textureSize, 'texelSize' );

    var unifRenderSize = Uniform.createFloat2( 'RenderSize' );
    this._renderSize = unifRenderSize.getInternalArray();
    this._renderSize[ 0 ] = this._renderSize[ 1 ] = this._textureSize;

    this._shaderProcessor = undefined;

    this._lights = [];
    this._shadowMaps = [];
    this._viewportDimension = [];


    if ( settings ) {

        this.setShadowSettings( settings );
        if ( settings.atlasSize ) this._textureSize = settings.atlasSize;
        if ( settings.textureSize ) this._shadowMapSize = settings.textureSize;

    }

    this._numShadowWidth = this._textureSize / this._shadowMapSize;
    this._numShadowHeight = this._textureSize / this._shadowMapSize;

};


/** @lends ShadowMapAtlas.prototype */
ShadowMapAtlas.prototype = MACROUTILS.objectLibraryClass( MACROUTILS.objectInherit( ShadowTechnique.prototype, {

    getDepthRange: function ( numShadow ) {
        return this._shadowMaps[ numShadow ].getDepthRange();
    },

    getTexture: function () {
        return this._texture;
    },

    isDirty: function ( numShadow ) {
        if ( numShadow !== undefined ) {
            return this._shadowMaps[ numShadow ].isDirty();
        } else {
            for ( var i = 0, l = this._shadowMaps.length; i < l; i++ ) {
                if ( this._shadowMaps[ i ].isDirty() ) return true;
            }
        }
        return false;
    },
    /**
     * at which Texture unit number we start adding texture shadow
     */
    setTextureUnitBase: function ( unitBase ) {
        this._textureUnitBase = unitBase;
        this._textureUnit = unitBase;
    },

    /* Sets  shadowSettings
     */
    setShadowSettings: function ( shadowSettings ) {

        if ( !shadowSettings )
            return;

        for ( var i = 0, l = this._shadowMaps.length; i < l; i++ ) {
            this._shadowMaps[ i ].setShadowSettings( shadowSettings );
        }
        this.setTextureSize( shadowSettings.textureSize );
        this.setTexturePrecision( shadowSettings.textureType );

    },

    setCastsShadowDrawTraversalMask: function ( mask ) {

        for ( var i = 0, l = this._shadowMaps.length; i < l; i++ ) {
            this._shadowMaps[ i ].setCastsShadowDrawTraversalMask( mask );
        }

    },

    getCastsShadowDrawTraversalMask: function ( numShadow ) {

        if ( numShadow !== undefined ) {
            return this._shadowMaps[ numShadow ].getCastsShadowDrawTraversalMask();
        } else if ( this._shadowMaps.length !== 0 ) {
            return this._shadowMaps[ 0 ].getCastsShadowDrawTraversalMask();
        }

    },

    setCastsShadowBoundsTraversalMask: function ( mask ) {

        for ( var i = 0, l = this._shadowMaps.length; i < l; i++ ) {
            this._shadowMaps[ i ].setCastsShadowBoundsTraversalMask( mask );
        }

    },

    getCastsShadowBoundsTraversalMask: function ( numShadow ) {

        if ( numShadow !== undefined ) {
            return this._shadowMaps[ numShadow ].getCastsShadowDrawTraversalMask();
        } else if ( this._shadowMaps.length !== 0 ) {
            return this._shadowMaps[ 0 ].getCastsShadowDrawTraversalMask();
        }

    },


    getBias: function ( numShadow ) {

        if ( numShadow !== undefined ) {
            return this._shadowMaps[ numShadow ].getBias();
        } else if ( this._shadowMaps.length !== 0 ) {
            return this._shadowMaps[ 0 ].getBias();
        }

    },

    setBias: function ( value ) {

        for ( var i = 0, l = this._shadowMaps.length; i < l; i++ ) {
            this._shadowMaps[ i ].setBias( value );
        }

    },

    getExponent0: function ( numShadow ) {

        if ( numShadow !== undefined ) {
            return this._shadowMaps[ numShadow ].getExponent0();
        } else if ( this._shadowMaps.length !== 0 ) {
            return this._shadowMaps[ 0 ].getExponent0();
        }

    },

    setExponent0: function ( value ) {

        for ( var i = 0, l = this._shadowMaps.length; i < l; i++ ) {
            this._shadowMaps[ i ].setExponent0( value );
        }

    },

    getExponent1: function ( numShadow ) {

        if ( numShadow !== undefined ) {
            return this._shadowMaps[ numShadow ].getExponent1();
        } else if ( this._shadowMaps.length !== 1 ) {
            return this._shadowMaps[ 0 ].getExponent1();
        }

    },

    setExponent1: function ( value ) {

        for ( var i = 0, l = this._shadowMaps.length; i < l; i++ ) {
            this._shadowMaps[ i ].setExponent1( value );
        }

    },

    getEpsilonVSM: function ( numShadow ) {

        if ( numShadow !== undefined ) {
            return this._shadowMaps[ numShadow ].getEpsilonVSM();
        } else if ( this._shadowMaps.length !== 1 ) {
            return this._shadowMaps[ 0 ].getEpsilonVSM();
        }

    },

    setEpsilonVSM: function ( value ) {

        for ( var i = 0, l = this._shadowMaps.length; i < l; i++ ) {
            this._shadowMaps[ i ].setEpsilonVSM( value );
        }
    },
    getKernelSizePCF: function ( numShadow ) {

        if ( numShadow !== undefined ) {
            return this._shadowMaps[ numShadow ].getKernelSizePCF();
        } else if ( this._shadowMaps.length !== 1 ) {
            return this._shadowMaps[ 0 ].getKernelSizePCF();
        }

    },

    setKernelSizePCF: function ( value ) {

        for ( var i = 0, l = this._shadowMaps.length; i < l; i++ ) {
            this._shadowMaps[ i ].setKernelSizePCF( value );
        }
    },
    getFakePCF: function ( numShadow ) {

        if ( numShadow !== undefined ) {
            return this._shadowMaps[ numShadow ].getFakePCF();
        } else if ( this._shadowMaps.length !== 1 ) {
            return this._shadowMaps[ 0 ].getFakePCF();
        }

    },

    setFakePCF: function ( value ) {

        for ( var i = 0, l = this._shadowMaps.length; i < l; i++ ) {
            this._shadowMaps[ i ].setFakePCF( value );
        }
    },
    getRotateOffset: function ( numShadow ) {

        if ( numShadow !== undefined ) {
            return this._shadowMaps[ numShadow ].getRotateOffset();
        } else if ( this._shadowMaps.length !== 1 ) {
            return this._shadowMaps[ 0 ].getRotateOffset();
        }

    },

    setRotateOffset: function ( value ) {

        for ( var i = 0, l = this._shadowMaps.length; i < l; i++ ) {
            this._shadowMaps[ i ].setRotateOffset( value );
        }
    },

    setShadowedScene: function ( shadowedScene ) {

        ShadowTechnique.prototype.setShadowedScene.call( this, shadowedScene );
        this._receivingStateset = this._shadowedScene.getReceivingStateSet();

        for ( var i = 0, l = this._shadowMaps.length; i < l; i++ ) {
            this._shadowMaps[ i ].setShadowedScene( shadowedScene );
        }

    },

    setTexturePrecision: function ( value ) {

        for ( var i = 0, l = this._shadowMaps.length; i < l; i++ ) {
            this._shadowMaps[ i ].setTexturePrecision( value );
        }

    },

    getTexturePrecision: function ( numShadow ) {

        if ( numShadow !== undefined ) {
            return this._shadowMaps[ numShadow ].getTexturePrecision();
        } else if ( this._shadowMaps.length !== 1 ) {
            return this._shadowMaps[ 0 ].getTexturePrecision();
        }

    },

    setShadowMapSize: function ( mapSize, lightNum ) {


        this._shadowMapSize = mapSize;
        this._numShadowWidth = this._textureSize / this._shadowMapSize;
        this._numShadowHeight = this._textureSize / this._shadowMapSize;

        if ( !lightNum ) {
            for ( var i = 0, l = this._shadowMaps.length; i < l; i++ ) {
                this._shadowMaps[ i ].setTextureSize( mapSize );
            }
        } else {
            this._shadowMaps[ lightNum ].setTextureSize( mapSize );
        }

    },

    setTextureSize: function ( mapSize ) {

        if ( mapSize === this._textureSize ) return;

        this._textureSize = mapSize;

        this._shadowMapSize = 256;
        this._numShadowWidth = this._textureSize / this._shadowMapSize;
        this._numShadowHeight = this._textureSize / this._shadowMapSize;

        this.dirty();
    },

    setAlgorithm: function ( algo, lightNum ) {

        if ( !lightNum ) {
            for ( var i = 0, l = this._shadowMaps.length; i < l; i++ ) {
                this._shadowMaps[ i ].setAlgorithm( algo );
            }
        } else {
            this._shadowMaps[ lightNum ].setAlgorithm( algo );
        }

    },

    getAlgorithm: function ( numShadow ) {

        if ( numShadow !== undefined ) {
            return this._shadowMaps[ numShadow ].getAlgorithm();
        } else if ( this._shadowMaps.length !== 1 ) {
            return this._shadowMaps[ 0 ].getAlgorithm();
        }

    },

    getShadowMap( lightNum ) {
        return this._shadowMaps[ lightNum ];
    },

    addLight: function ( light, settings ) {

        if ( !light )
            return -1;

        var lightNum = this._lights.indexOf( light );
        if ( lightNum !== -1 )
            return lightNum;

        lightNum = this._lights.length;

        this._lights.push( light );
        var shadowMap = new ShadowMap( settings );
        this._shadowMaps.push( shadowMap );


        var y = lightNum % ( this._numShadowWidth );
        var x = Math.floor( lightNum / ( this._numShadowHeight ) );
        var mapSize = this._shadowMapSize;

        this._viewportDimension.push( vec4.fromValues( x, y, mapSize, mapSize ) );

        return shadowMap;
    },

    setLight: function ( light, lightNum ) {

        if ( !light || this._lights.indexOf( light ) !== -1 )
            return;

        this._lights[ lightNum ] = light;
        this.dirty();
    },

    /** initialize the ShadowedScene and local cached data structures.*/
    init: function () {

        if ( !this._shadowedScene ) return;

        this.initTexture();

        this._textureUnit = this._textureUnitBase;
        this._texture.setLightUnitStart( this._textureUnit );
        this._texture.setName( 'ShadowTexture' + this._textureUnit );

        this._numShadowWidth = this._textureSize / this._shadowMapSize;
        this._numShadowHeight = this._textureSize / this._shadowMapSize;

        var unifRenderSize = Uniform.createFloat2( 'RenderSize' );
        this._texelSizeUniform = Uniform.createFloat1( 1.0 / this._textureSize, 'texelSize' );
        this._renderSize = unifRenderSize.getInternalArray();
        this._renderSize[ 0 ] = this._renderSize[ 1 ] = this._textureSize;

        for ( var i = 0, l = this._shadowMaps.length; i < l; i++ ) {

            var y = i % ( this._numShadowWidth );
            var x = Math.floor( i / ( this._numShadowHeight ) );
            var mapSize = this._shadowMapSize;

            this._viewportDimension[ i ] = vec4.fromValues( x, y, mapSize, mapSize );
            this._shadowMaps[ i ].init( this._texture );

        }

    },
    valid: function () {
        // checks
        return true;
    },

    updateShadowTechnique: function ( nv ) {

        for ( var i = 0, l = this._shadowMaps.length; i < l; i++ ) {
            this._shadowMaps[ i ].updateShadowTechnique( nv, this._viewportDimension[ i ] );
        }

    },

    updateShadowTechnic: function ( /*nv*/) {
        Notify.log( 'ShadowMap.updateShadowTechnic() is deprecated, use updateShadowTechnique instead' );
        this.updateShadowTechnique();
    },

    setTextureFiltering: function () {

        var textureType, texFilterMin, texFilterMag;
        var texType = this.getTexturePrecision();
        if ( this._texture ) {
            // see shadowSettings.js header
            switch ( this.getAlgorithm() ) {
            case 'ESM':
            case 'VSM':
            case 'EVSM':
                texFilterMin = Texture.LINEAR;
                texFilterMag = Texture.LINEAR;
                break;

            default:
            case 'PCF':
            case 'NONE':
                if ( this.getFakePCF() ) {
                    texFilterMin = Texture.LINEAR;
                    texFilterMag = Texture.LINEAR;

                    // // TODO try anisotropy with better biaspcf
                    // texFilterMin = Texture.LINEAR_MIPMAP_LINEAR;
                    // texFilterMag = Texture.LINEAR_MIPMAP_LINEAR;
                    // this._texture.setMaxAnisotropy( 16 );


                } else {
                    texFilterMin = Texture.NEAREST;
                    texFilterMag = Texture.NEAREST;
                }
                break;
            }

            switch ( texType ) {
            case 'HALF_FLOAT':
                textureType = Texture.HALF_FLOAT;
                texFilterMin = Texture.NEAREST;
                texFilterMag = Texture.NEAREST;
                break;
            case 'HALF_FLOAT_LINEAR':
                textureType = Texture.HALF_FLOAT;
                texFilterMin = Texture.LINEAR;
                texFilterMag = Texture.LINEAR;
                break;
            case 'FLOAT':
                textureType = Texture.FLOAT;
                texFilterMin = Texture.NEAREST;
                texFilterMag = Texture.NEAREST;
                break;
            case 'FLOAT_LINEAR':
                textureType = Texture.FLOAT;
                texFilterMin = Texture.LINEAR;
                texFilterMag = Texture.LINEAR;
                break;
            default:
            case 'UNSIGNED_BYTE':
                textureType = Texture.UNSIGNED_BYTE;
                break;
            }
        }

        this._texture.setInternalFormatType( textureType );
        this._texture.setMinFilter( texFilterMin );
        this._texture.setMagFilter( texFilterMag );
        this._textureMagFilter = texFilterMag;
        this._textureMinFilter = texFilterMin;

    },

    // internal texture allocation
    // handle any change like resize, filter param, etc.
    initTexture: function () {

        if ( !this._dirty ) return;

        if ( !this._texture ) {
            this._texture = new ShadowTextureAtlas();
            this._textureUnit = this._textureUnitBase;
        }


        this._texture.setTextureSize( this._textureSize, this._textureSize );
        this._texelSizeUniform.setFloat( 1.0 / this._textureSize );
        this._renderSize[ 0 ] = this._textureSize;
        this._renderSize[ 1 ] = this._textureSize;

        var textureFormat;
        // luminance Float format ?
        textureFormat = Texture.RGBA;

        this.setTextureFiltering();
        this._texture.setInternalFormat( textureFormat );

        this._texture.setWrapS( Texture.CLAMP_TO_EDGE );
        this._texture.setWrapT( Texture.CLAMP_TO_EDGE );

        this._texture.dirty();

    },

    // Defines the frustum from light param.
    //
    cullShadowCasting: function ( cullVisitor ) {

        for ( var i = 0, l = this._shadowMaps.length; i < l; i++ ) {
            this._shadowMaps[ i ].cullShadowCasting( cullVisitor );
        }

    },

    cleanReceivingStateSet: function () {

        if ( this._receivingStateset ) {

            if ( this._texture ) {
                // remove this._texture, but not if it's not this._texture
                if ( this._receivingStateset.getTextureAttribute( this._textureUnit, this._texture.getTypeMember() ) === this._texture )
                    this._receivingStateset.removeTextureAttribute( this._textureUnit, this._texture.getTypeMember() );
            }

            for ( var i = 0, l = this._shadowMaps.length; i < l; i++ ) {
                this._shadowMaps[ i ].cleanReceivingStateSet();
            }

        }

    },
    cleanSceneGraph: function () {
        // TODO: need state
        //this._texture.releaseGLObjects();
        //this._shadowReceiveAttribute = undefined;
        this._texture = undefined;
        this._shadowedScene = undefined;
    },

    setDebug: function ( enable, lightNum ) {

        if ( !lightNum ) {
            for ( var i = 0, l = this._shadowMaps.length; i < l; i++ ) {
                this._shadowMaps[ i ].setDebug( enable );
            }
        } else {
            this._shadowMaps[ lightNum ].setDebug( enable );
        }

    },

} ), 'osgShadow', 'ShadowMapAtlas' );

MACROUTILS.setTypeID( ShadowMapAtlas );

module.exports = ShadowMapAtlas;
