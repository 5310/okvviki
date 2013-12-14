/**
 * Contains all the okvviki functionality.
 *
 * @namespace
 */
okvviki = {

    /**
     * Properties that defines the okvviki app instance.
     *
     * @property    {String}    domain - The domain this okvviki instance operate under and will generate URL for. Can be relative.
     * @property    {String}    notebookKeyParam - The parameter name denoting notebook keys in this okvviki instance.
     * @property    {String}    pageKeyParam - The parameter name denoting page keys in this okvviki instance.
     * @property    {Number}    autosaveDelay - The idle-time before autosave after user stops typing.
     * @property    {Boolean}   demoMode - If true, the index page will be reset every time the app loads.
     */
    config: {
        okvPrefix: '5310okvviki',
        domain: 'index.html',
        notebookKeyParam: 'n',
        pageKeyParam: 'p',
        autosaveDelay: 1000,
        demoMode: true,
    },

    /**
     * Stores the states for the app.
     *
     * @property    {Page}      currentPage - The currently loaded page, if any.
     * @property    {Page}      currentPageUndo - The currently unsused backup page.
     * @property    {Boolean}   editmode - True if edit mode is active.
     */
    states: {
        currentPage: null,
        currentPageUndo: null,
        editmode: false,
    },

    /**
     * Sets up all required callbacks, etc.
     *
     * Sets handlers to intercept local okvviki links dynamically.
     * Sets handler to load page on history change.
     * Sets the autosave function on edit field defocus or pause.
     * Sets the page load function on ready.
     */
    init: function() {
        // The main on ready function.
        $('body').ready( function() {

            // Set text-area to auto-expand.
            $('textarea').autosize();

            // Intercepts all content links and dynamically loads local pages.
            $('#display_content').on( 'click', 'a', function( event ) {
                var url = event.srcElement.href;
                try {
                    var keys = okvviki.parseKeysFromURL(url);
                    okvviki.openLink( keys );
                    return event.preventDefault();
                } catch (error) {
                }
            } );

            // Autoloads on browser history state change.
            window.onpopstate = function( event ) {
                okvviki.loadPage();
            };

            // Change focus to content on title edit enter.
            $('#edit_title').on( 'keyup', function( event ) {
                var code = event.which;
                if ( code == 13 ) {
                    $('#edit_content').focus();
                }
            } );

            // Autosaves on edit element defocus.
            var defocusSave = function( event ) {
                okvviki.savePage();
            };
            $('#edit_title').on( 'blur', defocusSave );
            $('#edit_content').on( 'blur', defocusSave );

            // Autosaves upon idling for a while during edit.
            /** @see    http://stackoverflow.com/a/1909508 */
            var resettingDelay = ( function() {
              var timer = 0;
              return function( callback, ms ) {
                clearTimeout ( timer );
                timer = setTimeout( callback, ms );
              };
            } )();
            var idleSave = function( event ) {
                resettingDelay(function(){
                    okvviki.savePage();
                }, okvviki.config.autosaveDelay );
            };
            $('#edit_title').on( 'keyup', idleSave);
            $('#edit_content').on( 'keyup', idleSave);

            // Shortcuts.
            $(window).on( 'keydown', function( event ) {
                if ( event.ctrlKey || event.metaKey ) {
                    switch ( String.fromCharCode(event.which).toLowerCase() ) {
                    case 's':
                        if ( okvviki.states.currentPage ) {
                            okvviki.savePage();
                        }
                        event.preventDefault();
                        break;
                    case 'e':
                        if ( okvviki.states.currentPage ) {
                            okvviki.setEditMode();
                        }
                        event.preventDefault();
                        break;
                    }
                }
            } );

            // Toolbar buttons:
            // Toggle edit mode.
            $('#edit_button').on( 'click', function( event ) {
                okvviki.setEditMode(true);
            } );
            // Save page.
            $('#save_button').on( 'click', function( event ) {
                okvviki.savePage();
                okvviki.setEditMode(false);

            } );
            // Delete page.
            $('#delete_button').on( 'click', function( event ) {
                $('#delete_modal')
                    .modal('setting', {
                        closable: false,
                        onDeny: function () {
                            okvviki.deletePage();
                            okvviki.setEditMode(false);
                        },
                        onApprove: function () {
                        }
                    })
                    .modal('show');
            } );
            $('.help_button').on( 'click', function( event ) {
                $('#help_modal')
                    .modal('show');
            } );

            okvviki.loadPage();

        } );
    },

    /**
     * The okvviki page object.
     *
     * Page objects are used to store okvviki pages as well as the special-case page known as the notebook which contains other pages.
     * These are simple Javascript objects which will be stored directly to OKV. Naturally, they contain just data and no additional methods.
     *
     * @typedef     {Object}    Page
     * @property    {String}    title - An optional title for the okvviki page.
     * @property    {String}    content - The okvviki flavored Markdown string content of the page.
     * @property    {Boolean}   isNotebook - Whether or
     * @property    {Array}     notebookPages - List of pages contained in this notebook page object.
     */
    /**
     * Constructs a generic page object.
     *
     * @constructor
     */
    Page: function() {
        this.title = "";
        this.content = "";
        this.isNotebook = false;
        this.notebookPages = [];
    },

    /**
     * The okvviki key object.
     *
     * A simple Javascript object containing the page and notebook keys needed for many functionality.
     *
     * @typedef     {Object}    Keys
     * @property    {String}    pageKey - The unique page key.
     * @property    {String}    notebookKey - The unique notebook key of the page.
     */

    /**
     * Reads the okvviki keys from the currently loaded URL's query strings.
     *
     * It parses the properties by the given names in config.
     *
     * @param       {String}    [url] - An url to parse. Defaults to current URL.
     *
     * @returns     {Keys}      keys - Object containing parsed keys.
     */
    parseKeysFromURL: function( url ) {
        var url = url ? url : window.location.href;
        var keys = {
            notebookKey: getParameterFromURL( okvviki.config.notebookKeyParam, url ),
            pageKey: getParameterFromURL( okvviki.config.pageKeyParam, url )
        };
        /* Denotbookification.
        if ( keys.notebookKey == '' ) {
            throw "No notebook key found. UNACCEPTABLE!";
        }
        */
        return keys;
    },

    /**
     * Reads given okvviki Markdown shorthand link and parses out the keys.
     *
     * It assumes that the string given is a valid okvviki shorthand link.
     *
     * It returns both the notebook and page keys. If there is only one of each,
     * it will set the other to blank. And it assumes that a flat key is always the pagekey.
     * The assumptions go like this:
     *
     *  -   `a/b`:  notekey = a, pagekey = b
     *  -   `c`:    notekey = none, pagekey = c
     *  -   `d/`:   notekey = d, pagekey = none
     *  -   `/e`:   notekey = none, pagekey = e
     *
     * @param       {String}    shorthand - The shorthand being parsed.
     *
     * @returns     {Keys}    keys - Object containing parsed keys.
     */
    parseKeysFromShorthand: function( shorthand ) {
        var shorthand = shorthand.trim().toLowerCase();
        var regex = /^([^\.\:\/]*)\/?([^\.\/]*)$/g;
        var match = regex.exec(shorthand);
        // Remember, the first entry in the augmented array match is the concatenation of matched groups. Start from [1].
        if ( match[0].search('/') == -1 ) {
            // When there are no /'s and therefor only the page key present.
            var keys = {
                notebookKey: '',
                pageKey: match[1]
            };
        } else {
            // Otherwise, read both notebook and page key.
            var keys = {
                notebookKey: match[1],
                pageKey: match[2]
            };
        }
        return keys;
    },

    /**
     * Converts any given string to a valid key for querystring property and OKV storage.
     *
     * @param       {String}    string - The arbitrary string to be cleaned.
     *
     * @returns     {String}    key - The cleaned key.
     *
     * @throws      Throws an exception if the converted key is empty.
     */
    makeValidKey: function( string ) {
        if ( string.trim() == '' ) {
            return '';
        } else {
            var key = removeDiacritics(string.toLowerCase().trim()).replace(/[\.,!?;:'"]/gi, '').replace(/[^a-z0-9\+-~_]/gi, '_');
            if ( key == '' ) {
                throw "Key cannot be made valid. UNACCEPTABLE!";
            }
            return key;
        }
    },

    /**
     * Converts any given string to a valid key for querystring property and OKV storage.
     *
     * @param       {Number}    [n] - Length of the key to generate. Defaults to 8.
     *
     * @returns     {String}    key - The generated random key.
     */
    generateRandomKey: function( n ) {
        var n = n ? Math.round(Math.abs(n)) : 8;
        var key = '';
        for ( var i = 0; i < n; i++ ) {
            key += "x";
        }
        key = key.replace(/[x]/g, function(c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });
        return key;
    },

    /**
     * Creates an URL from okvviki keys.
     *
     * @param       {String|Keys}   pageKey|keys - The unique key denoting the okvviki page inside its notebook. Or an object containing both keys.
     * @param       {String}    [notebookKey] - The unique key denoting the notebook this page belongs to. Defaults to the currently loaded notebook.
     *
     * @returns     {String}    url - The generated okvviki URL.
     */
    // Returns an URL string.
    generatePageURL: function( pageKey, notebookKey ) {
        if ( typeof pageKey === 'string' ) {
            var notebookKey = okvviki.makeValidKey( notebookKey );
            var pageKey = okvviki.makeValidKey( pageKey );
        } else {
            var notebookKey = okvviki.makeValidKey( pageKey.notebookKey );
            var pageKey = okvviki.makeValidKey( pageKey.pageKey );
        }
        /* Denotebookification.
        notebookKey = notebookKey ? notebookKey : okvviki.parseKeysFromURL().notebookKey;
        var url = okvviki.config.domain+'?'+okvviki.config.notebookKeyParam+'='+notebookKey;
        */
        var url = okvviki.config.domain+'?'; // Denotebookification.
        url += pageKey != '' ? '&'+okvviki.config.pageKeyParam+'='+pageKey : '';
        return url;
    },

    /**
     * Directly modifies the page's okvviki flavored Markdown in order to fill in autokeys or other macros.
     *
     * @param       {Page}      page - The okvviki page object whose content is to be expanded.
     *
     * @returns     {Page}      page - The given and modified page object.
     */
    expand: function( page ) {
        var content = page.content;
        // Expand direct explicit random shorthands.
        var regex = /(\[[^\[\]]+\]\()(\?)(\s*(?:"[^"]*")?\))/g;
        content = content.replace( regex, function( match, g1, g2, g3, index) {
            var key = okvviki.generateRandomKey();
            match = g1+key+g3;
            return match;
        } );
        // Preprocess direct implicit random shorthands.
        var regex = /(\[)(\?)(\]\(\))/g;
        content = content.replace( regex, function( match, g1, g2, g3, index) {
            var key = okvviki.generateRandomKey();
            match = g1+key+g3;
            return match;
        } );
        // Preprocess referntial shorthands.
        var regex = /(^\[[^\[\]]+\]:\s*)(\?)(\s*(?:["'\(].*["'\)])?$)/gm;
        content = content.replace( regex, function( match, g1, g2, g3, index) {
            var key = okvviki.generateRandomKey();
            match = g1+key+g3;
            return match;
        } );
        page.content = content;
        return page;
    },

    /**
     * Preprocesses a page's okvviki flavored Markdown to generate proper URLS for rendering with Markdown.
     *
     * @this        okvviki
     *
     * @param       {Page}      page - The okvviki page object whose content is to be expanded.
     *
     * @returns     {String}    page - A standard Markdown string.
     */
    preprocess: function( page ) {
        var markdown = page.content;
        // Preprocess direct explicit shorthands.
        var regex = /(\[[^\[\]]+\]\()([^\.\:\/\(\)\[\]\s"]+\/?[^\.\/\(\)\[\]\s"]*)(\s*(?:"[^"]*")?\))/g;
        markdown = markdown.replace( regex, function( match, g1, g2, g3, index) {
            var url = okvviki.generatePageURL(okvviki.parseKeysFromShorthand(g2));
            match = g1+url+g3;
            return match;
        } );
        // Preprocess direct implicit shorthands.
        var regex = /(\[)([^\.\:\/\(\)\[\]]+\/?[^\.\/\(\)\[\]]*)(\]\()(\))/g;
        markdown = markdown.replace( regex, function( match,  g1, g2, g3, g4, index) {
            var url = okvviki.generatePageURL(okvviki.parseKeysFromShorthand(g2));
            match = g1+g2+g3+url+g4;
            return match;
        } );
        // Preprocess refeerntial shorthands.
        var regex = /^(\[[^\[\]]+\]:\s*)([^\.\:\/\(\)\[\]\s"'\(\)]+\/?[^\.\/\(\)\[\]\s"'\(\)]*)(\s*(?:["'\(].*["'\)])?)$/gm;
        markdown = markdown.replace( regex, function( match, g1, g2, g3, index) {
            var url = okvviki.generatePageURL(okvviki.parseKeysFromShorthand(g2));
            match = g1+url+g3;
            return match;
        } );
        return markdown;
    },

    /**
     * Preprocesses and finally renders a page.
     *
     * TODO: Also set edit elements, toolbars, title, display state, scroll state, etc.
     *
     * @param       {Page}      page - The page to be finally rendered to html.
     * @param       {Object}    [element] - The element to output the rendered markdown to. Defaults to the #display_content element.
     *
     * @returns     {String}    html - The rendered HTML string.
     *
     * @throws      Throws an exception if rendering failed.
     */
    renderPage: function( page, element ) {
        var html = marked(okvviki.preprocess(page));
        if ( element ) {
            element.html(html);
        } else {
            $('#display_content').html(html);
        }
        var keys = okvviki.parseKeysFromURL();
        /* Denotebookification
        $('#notebookkey_shorthand').html(keys.notebookKey);
        $('#separator_shorthand').html("/");
        */
        $('#pagekey_shorthand').html(keys.pageKey);
        document.title = page.title;
        $('#display_title').html(page.title);
        $('#edit_title').val(page.title);
        $('#edit_content').val(page.content).trigger('autosize.resize');
        return html;
    },

    /**
     * Loads the okvviki page automatically from the current URL if valid.
     *
     * Retrieves the current URL's page object, and then renders it automatically.
     */
    loadPage: function() {
        try {
            var keys = okvviki.parseKeysFromURL();
            var download_status = $('#download_status');
            download_status.transition('fade in', 500);
            var callback = function( notebookKey, pageKey, page ) {
                // Reset index if set to demo mode.
                if ( okvviki.config.demoMode && !keys.pageKey ) {
                    page.title = "okvviki";
                    page.content =
                        '# **okvviki** is a toy wiki that uses slightly flavored [Markdown][1] for wiki-like formatting and linking and [OpenKeyval][2] for "storage".\n'+
                        '**Just edit any page to create any links using okvviki shorthands (click the help button above) to visit and/or edit [that page]('+okvviki.generateRandomKey(16)+'). Link between pages all wiki-like, you know the drill.**\n'+
                        '\n'+
                        'Find out more about this project and its source on [Github][3].\n'+
                        '\n'+
                        'Even _this_ particular instance of okvviki and all the pages herein can be edited anonymously and by anyone at all, and I take no responsibilities for any of the content that appears here! Being a demo, this index page which will usually be used to link to other hub pages, will be reset upon reload though. >:D\n'+
                        '\n'+
                        'Please note, okvviki is a simple toy app that uses [OpenKeyval][2] for storage, hence the name. [OpenKeyval][2] is a fine place for a tiny bit of experimental persistence, but it has no privacy or write-protection (while still being editable for our purposes) and absolutely no guarantees of retention. You should not use okvviki for any imporant data, that\'s just silly.\n'+
                        '\n'+
                        'If you\'d still like to use it, you can just [download][3] and host a static copy of this page anywhere and use that.  Just make sure to change the config to set demo mode to false.\n'+
                        '\n'+
                        '[1]: http://daringfireball.net/projects/markdown/syntax "Markdown Syntax Documentation"\n'+
                        '[2]: http://openkeyval.org/ "OpenKeyval, the Completely Open Key-value Data Store"\n'+
                        '[3]: https://github.com/5310/okvviki "okvviki Github Repository"\n'
                        ;
                }
                okvviki.states.currentPage = page;
                if ( !page.content ) {
                    okvviki.setEditMode(true);
                } else {
                    okvviki.setEditMode(false);
                }
                okvviki.renderPage(page);
                download_status.transition('fade out', 499);
                if ( okvviki.config.demoMode && !keys.pageKey ) {
                    okvviki.savePage();
                }
            };
            try {
                okvviki.retrievePage( callback, keys );
            } catch ( error ) {
                download_status.transition( {
                    animation: 'fade out',
                    duration: '1ms',
                    complete: function() {
                        $('#error_status')
                            .transition('fade in', 50)
                            .transition('pulse')
                            .transition('pulse')
                            .transition('pulse')
                            .transition('fade out', 1000);
                    }
                } );
                $('#separator_shorthand').html('loading failed');
                //TODO: Retry load later.
            }
            return true;
        } catch ( error ) {
            return false;
        }
    },

    /**
     * Saves the currently loaded okvviki page automatically.
     *
     * Commits the edited content text to the current page object, then expands and renders the current page, and then saves it.
     */
    savePage: function() {
        if ( okvviki.states.currentPage ) {
            var title = $('#edit_title').val();
            var keys = okvviki.parseKeysFromURL();
            okvviki.states.currentPage.title = title ? title : "Untitled Page";
            okvviki.states.currentPage.content = $('#edit_content').val();
            okvviki.expand(okvviki.states.currentPage);
            okvviki.renderPage(okvviki.states.currentPage);
            okvviki.states.currentPageUndo = clone(okvviki.states.currentPage);
            var upload_status = $('#upload_status')
            upload_status.transition('fade in', 500);
            var callback = function() {
                upload_status.transition('fade out', 499);
            };
            try {
                okvviki.storePage( callback, okvviki.states.currentPage, keys );
            } catch ( error ) {
                upload_status.transition( {
                    animation: 'fade out',
                    duration: '1ms',
                    complete: function() {
                        $('#error_status')
                            .transition('fade in', 50)
                            .transition('pulse')
                            .transition('pulse')
                            .transition('pulse')
                            .transition('fade out', 1000);
                    }
                } );
                //TODO: Retry save later.
            }
        }
    },

    /**
     * Deletes the currently loaded page.
     *
     * UI asks for confirmation. Resets page to desired clean slate state. Has an undo period.
     */
    deletePage: function() {
        if ( okvviki.states.currentPage ) {
            var keys = okvviki.parseKeysFromURL();
            okvviki.states.currentPageUndo = clone(okvviki.states.currentPage);
            var remove_status = $('#remove_status')
            remove_status.transition('fade in', 100);
            var callback = function() {
                okvviki.states.currentPage = null;
                remove_status.transition( {
                    animation: 'fade out',
                    duration: '1000ms',
                    complete: function() {
                        history.back();
                    }
                } );
            };
            try {
                okvviki.destroyPage( callback, keys );
            } catch ( error ) {
                remove_status.transition( {
                    animation: 'fade out',
                    duration: '1ms',
                    complete: function() {
                        $('#error_status')
                            .transition('fade in', 50)
                            .transition('pulse')
                            .transition('pulse')
                            .transition('pulse')
                            .transition('fade out', 1000);
                    }
                } );
                //TODO: Retry deletion later.
            }
        }
    },

    /**
     * Sets edit mode. Toggles if not argued.
     *
     * @param       {Boolean}   [state] - Which state to set editmode to. Defaults to toggle.
     */
    setEditMode: function( state ) {
        if ( state === undefined ) {
            okvviki.states.editmode = !okvviki.states.editmode;
        } else {
            okvviki.states.editmode = state;
        }
        if ( okvviki.states.editmode ) {

            if ( $('#display').transition('is visible') ) $('#display').transition('fade out');
            if ( !$('#edit').transition('is visible') ) $('#edit').transition('fade in');
            $('#edit_content').focus().trigger('autosize.resize');
            var content = $('#edit_content').val();
            $('#edit_content').val('');
            $('#edit_content').val(content);

            if ( $('#toolbar_displaymode').transition('is visible') ) $('#toolbar_displaymode').transition('fade down out', 100);
            if ( !$('#toolbar_editmode').transition('is visible') ) $('#toolbar_editmode').transition('fade down in', 100);

        } else {

            if ( !$('#display').transition('is visible') ) $('#display').transition('fade in');
            if ( $('#edit').transition('is visible') ) $('#edit').transition('fade out');

            if ( !$('#toolbar_displaymode').transition('is visible') ) $('#toolbar_displaymode').transition('fade down in', 100);
            if ( $('#toolbar_editmode').transition('is visible') ) $('#toolbar_editmode').transition('fade down out', 100);

        }
    },

    /**
     * Dynamically open the given okvviki key of the same domain.
     *
     * Simply changes history stack and lets the handler update the page.
     */
    openLink: function( pageKey, notebookKey ) {
        if ( typeof pageKey != 'string' ) {
            var notebookKey = pageKey.notebookKey;
            var pageKey = pageKey.pageKey;
        } else {
            var notebookKey = notebookKey ? notebookKey : okvviki.parseKeysFromURL().notebookKey;
            var pageKey = pageKey;
        }
        notebookKey = okvviki.makeValidKey( notebookKey );
        pageKey = okvviki.makeValidKey( pageKey );
        window.history.pushState( { pageKey: pageKey, notebookKey: notebookKey }, "loading", okvviki.generatePageURL( pageKey, notebookKey ) );
    },

    /**
     * This callback format will be run after page object load save or delete requests.
     *
     * @callback    pageIOCallback
     * @param       {String}        notebookKey - The notebook key of the page being dealth with.
     * @param       {String}        pageKey - Key of the page being dealt with.
     * @param       {?Page}         page - The page object being dealth with.
    */

    /**
     * This is a debung function that just prints all the parameters given to a pageIO callback.
     *
     * @see         pageIOCallback
     */
    _debugPageIOCallback: function( notebookKey, pageKey, page ) {
        console.log( page );
        console.log( notebookKey );
        console.log( pageKey );
    },

    /**
     * Loads an okvviki page object from OKV.
     *
     * @param       {pageIOCallback}    callback - The callback that receives the loaded page if any and keys. Not optional if you want to get anything done.
     * @param       {String|Keys}       pageKey|keys - The unique key denoting the okvviki page inside its notebook. OR An okvviki keys object containing both keys.
     * @param       {String}    [notebookKey] - The unique key for the notebook of page. Defaults to the currently loaded notebook. Only used if key pagekey is a string.
     *
     * @throws      Throws an exception if composite key is too short.
     * @throws      Throws an exception if composite key is too long.
     */
    retrievePage: function( callback, pageKey, notebookKey ) {

        if ( typeof pageKey != 'string' ) {
            var notebookKey = pageKey.notebookKey;
            var pageKey = pageKey.pageKey;
        } else {
            var notebookKey = notebookKey ? notebookKey : okvviki.parseKeysFromURL().notebookKey;
            var pageKey = pageKey;
        }
        notebookKey = okvviki.makeValidKey( notebookKey );
        pageKey = okvviki.makeValidKey( pageKey );

        var key = okvviki.config.okvPrefix+notebookKey+pageKey;
        if ( key.length <= 0 ) {
            throw "Key is too short. UNACCEPTABLE!!";
        } else if ( key.length > 128 ) {
            throw "Key is too long. UNACCEPTABLE!!";
        }

        remoteStorage.getItem( key, function( value, key ) {
            if ( callback ) {
                var page = JSON.parse(value);
                if ( page == null ) {
                    page = new okvviki.Page();
                }
                callback( notebookKey, pageKey, page );
            }
        } );

    },

    /**
     * Saves an okvviki page object to OKV given the keys. Also expands okvviki flavored Markdown shorthands.
     *
     * @param       {?pageIOCallback}    callback - The callback that receives the page object and keys after it's saved, for what it's worth.
     * @param       {Page}      page - The okvviki page object being stored.
     * @param       {String|Keys}       pageKey|keys - The unique key denoting the okvviki page inside its notebook. OR An okvviki keys object containing both keys.
     * @param       {String}    [notebookKey] - The unique key for the notebook of page. Defaults to the currently loaded notebook. Only used if key pagekey is a string.
     *
     * @throws      Throws an exception if composite key is too short.
     * @throws      Throws an exception if composite key is too long.
     * @throws      Throws an exception if OKV failed to store the page object.
     */
    storePage: function( callback, page, pageKey, notebookKey ) {

        if ( typeof pageKey != 'string' ) {
            var notebookKey = pageKey.notebookKey;
            var pageKey = pageKey.pageKey;
        } else {
            var notebookKey = notebookKey ? notebookKey : okvviki.parseKeysFromURL().notebookKey;
            var pageKey = pageKey;
        }
        notebookKey = okvviki.makeValidKey( notebookKey );
        pageKey = okvviki.makeValidKey( pageKey );

        var key = okvviki.config.okvPrefix+notebookKey+pageKey;
        if ( key.length <= 0 ) {
            throw "Key is too short. UNACCEPTABLE!!";
        } else if ( key.length > 128 ) {
            throw "Key is too long. UNACCEPTABLE!!";
        }

        var value = JSON.stringify(page);
        remoteStorage.setItem( key, value, function( response ) {
            if ( response.status != 'multiset' ) {
                throw "Failure to save the page object to OKV. UNACCEPTABLE!!"
            } else {
                if ( callback ) {
                    callback( notebookKey, pageKey, page );
                }
            }
        } );

    },

    /**
     * Deletes an okvviki page object from OKV given the keys.
     *
     * @param       {?pageIOCallback}    callback - The callback that receives a null page object and they keys used to delete it, for what it's worth.
     * @param       {String|Keys}       pageKey|keys - The unique key denoting the okvviki page inside its notebook. OR An okvviki keys object containing both keys.
     * @param       {String}    [notebookKey] - The unique key for the notebook of page. Defaults to the currently loaded notebook. Only used if key pagekey is a string.
     *
     * @throws      Throws an exception if composite key is too short.
     * @throws      Throws an exception if composite key is too long.
     * @throws      Throws an exception if OKV failed to delete the page object.
     */
    destroyPage: function( callback, pageKey, notebookKey ) {

        if ( typeof pageKey != 'string' ) {
            var notebookKey = pageKey.notebookKey;
            var pageKey = pageKey.pageKey;
        } else {
            var notebookKey = notebookKey ? notebookKey : okvviki.parseKeysFromURL().notebookKey;
            var pageKey = pageKey;
        }
        notebookKey = okvviki.makeValidKey( notebookKey );
        pageKey = okvviki.makeValidKey( pageKey );

        var key = okvviki.config.okvPrefix+notebookKey+pageKey;
        if ( key.length <= 0 ) {
            throw "Key is too short. UNACCEPTABLE!!";
        } else if ( key.length > 128 ) {
            throw "Key is too long. UNACCEPTABLE!!";
        }

        remoteStorage.deleteItem( key, function( response ) {
            if ( response.status != 'multiset' ) {
                throw "Failure to delete the page object from OKV. UNACCEPTABLE!!"
            } else {
                if ( callback ) {
                    callback( notebookKey, pageKey, null );
                }
            }
        } );

    },

};
okvviki.init();



/**
 * Returns the querystring value given a parameter name.
 *
 * @param       {String}    name - The querystring parameter being retrieved.
 * @param       {String}    [url] - URL to parse. Defaults to currently loaded url.
 *
 * @returns      {String}    The value of the retrieved querystring parameter.
 */
getParameterFromURL = function( name, url ) {
    var url = url ? url : window.location.href;
    name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
    var regexS = "[\\?&]"+name+"=([^&#]*)";
    var regex = new RegExp( regexS );
    var results = regex.exec( url );
    if( results == null )
        return "";
    else
        return decodeURIComponent(results[1].replace(/\+/g, " "));
};

/**
 * Clones most Javascript objects.
 *
 * @param       {Object}    object - The object to be cloned.
 *
 * @returns      {Object}    The cloned object.
 */
clone = function( object ) {
    // Handle the 3 simple types, and null or undefined
    if (null == object || "object" != typeof object) return object;

    // Handle Date
    if (object instanceof Date) {
        var copy = new Date();
        copy.setTime(object.getTime());
        return copy;
    }

    // Handle Array
    if (object instanceof Array) {
        var copy = [];
        for (var i = 0, len = object.length; i < len; i++) {
            copy[i] = clone(object[i]);
        }
        return copy;
    }

    // Handle Object
    if (object instanceof Object) {
        var copy = {};
        for (var attr in object) {
            if (object.hasOwnProperty(attr)) copy[attr] = clone(object[attr]);
        }
        return copy;
    }

    throw new Error("Unable to copy object! Its type isn't supported.");
};

/**
 * Removes a lot of diacritics from given string and replaces them with closest equivalent plain roman letters.
 *
 * @see         Code borrowed from {@link http://stackoverflow.com/a/18123985 this} Stack Overflow answer.
 *
 * @param       {String}    str - String to be de-diacritized.
 *
 * @returns     {String}    A de-diacritized copy of the given string.
 */
removeDiacritics = function( str ) {

  var defaultDiacriticsRemovalMap = [
    {'base':'A', 'letters':/[\u0041\u24B6\uFF21\u00C0\u00C1\u00C2\u1EA6\u1EA4\u1EAA\u1EA8\u00C3\u0100\u0102\u1EB0\u1EAE\u1EB4\u1EB2\u0226\u01E0\u00C4\u01DE\u1EA2\u00C5\u01FA\u01CD\u0200\u0202\u1EA0\u1EAC\u1EB6\u1E00\u0104\u023A\u2C6F]/g},
    {'base':'AA','letters':/[\uA732]/g},
    {'base':'AE','letters':/[\u00C6\u01FC\u01E2]/g},
    {'base':'AO','letters':/[\uA734]/g},
    {'base':'AU','letters':/[\uA736]/g},
    {'base':'AV','letters':/[\uA738\uA73A]/g},
    {'base':'AY','letters':/[\uA73C]/g},
    {'base':'B', 'letters':/[\u0042\u24B7\uFF22\u1E02\u1E04\u1E06\u0243\u0182\u0181]/g},
    {'base':'C', 'letters':/[\u0043\u24B8\uFF23\u0106\u0108\u010A\u010C\u00C7\u1E08\u0187\u023B\uA73E]/g},
    {'base':'D', 'letters':/[\u0044\u24B9\uFF24\u1E0A\u010E\u1E0C\u1E10\u1E12\u1E0E\u0110\u018B\u018A\u0189\uA779]/g},
    {'base':'DZ','letters':/[\u01F1\u01C4]/g},
    {'base':'Dz','letters':/[\u01F2\u01C5]/g},
    {'base':'E', 'letters':/[\u0045\u24BA\uFF25\u00C8\u00C9\u00CA\u1EC0\u1EBE\u1EC4\u1EC2\u1EBC\u0112\u1E14\u1E16\u0114\u0116\u00CB\u1EBA\u011A\u0204\u0206\u1EB8\u1EC6\u0228\u1E1C\u0118\u1E18\u1E1A\u0190\u018E]/g},
    {'base':'F', 'letters':/[\u0046\u24BB\uFF26\u1E1E\u0191\uA77B]/g},
    {'base':'G', 'letters':/[\u0047\u24BC\uFF27\u01F4\u011C\u1E20\u011E\u0120\u01E6\u0122\u01E4\u0193\uA7A0\uA77D\uA77E]/g},
    {'base':'H', 'letters':/[\u0048\u24BD\uFF28\u0124\u1E22\u1E26\u021E\u1E24\u1E28\u1E2A\u0126\u2C67\u2C75\uA78D]/g},
    {'base':'I', 'letters':/[\u0049\u24BE\uFF29\u00CC\u00CD\u00CE\u0128\u012A\u012C\u0130\u00CF\u1E2E\u1EC8\u01CF\u0208\u020A\u1ECA\u012E\u1E2C\u0197]/g},
    {'base':'J', 'letters':/[\u004A\u24BF\uFF2A\u0134\u0248]/g},
    {'base':'K', 'letters':/[\u004B\u24C0\uFF2B\u1E30\u01E8\u1E32\u0136\u1E34\u0198\u2C69\uA740\uA742\uA744\uA7A2]/g},
    {'base':'L', 'letters':/[\u004C\u24C1\uFF2C\u013F\u0139\u013D\u1E36\u1E38\u013B\u1E3C\u1E3A\u0141\u023D\u2C62\u2C60\uA748\uA746\uA780]/g},
    {'base':'LJ','letters':/[\u01C7]/g},
    {'base':'Lj','letters':/[\u01C8]/g},
    {'base':'M', 'letters':/[\u004D\u24C2\uFF2D\u1E3E\u1E40\u1E42\u2C6E\u019C]/g},
    {'base':'N', 'letters':/[\u004E\u24C3\uFF2E\u01F8\u0143\u00D1\u1E44\u0147\u1E46\u0145\u1E4A\u1E48\u0220\u019D\uA790\uA7A4]/g},
    {'base':'NJ','letters':/[\u01CA]/g},
    {'base':'Nj','letters':/[\u01CB]/g},
    {'base':'O', 'letters':/[\u004F\u24C4\uFF2F\u00D2\u00D3\u00D4\u1ED2\u1ED0\u1ED6\u1ED4\u00D5\u1E4C\u022C\u1E4E\u014C\u1E50\u1E52\u014E\u022E\u0230\u00D6\u022A\u1ECE\u0150\u01D1\u020C\u020E\u01A0\u1EDC\u1EDA\u1EE0\u1EDE\u1EE2\u1ECC\u1ED8\u01EA\u01EC\u00D8\u01FE\u0186\u019F\uA74A\uA74C]/g},
    {'base':'OI','letters':/[\u01A2]/g},
    {'base':'OO','letters':/[\uA74E]/g},
    {'base':'OU','letters':/[\u0222]/g},
    {'base':'P', 'letters':/[\u0050\u24C5\uFF30\u1E54\u1E56\u01A4\u2C63\uA750\uA752\uA754]/g},
    {'base':'Q', 'letters':/[\u0051\u24C6\uFF31\uA756\uA758\u024A]/g},
    {'base':'R', 'letters':/[\u0052\u24C7\uFF32\u0154\u1E58\u0158\u0210\u0212\u1E5A\u1E5C\u0156\u1E5E\u024C\u2C64\uA75A\uA7A6\uA782]/g},
    {'base':'S', 'letters':/[\u0053\u24C8\uFF33\u1E9E\u015A\u1E64\u015C\u1E60\u0160\u1E66\u1E62\u1E68\u0218\u015E\u2C7E\uA7A8\uA784]/g},
    {'base':'T', 'letters':/[\u0054\u24C9\uFF34\u1E6A\u0164\u1E6C\u021A\u0162\u1E70\u1E6E\u0166\u01AC\u01AE\u023E\uA786]/g},
    {'base':'TZ','letters':/[\uA728]/g},
    {'base':'U', 'letters':/[\u0055\u24CA\uFF35\u00D9\u00DA\u00DB\u0168\u1E78\u016A\u1E7A\u016C\u00DC\u01DB\u01D7\u01D5\u01D9\u1EE6\u016E\u0170\u01D3\u0214\u0216\u01AF\u1EEA\u1EE8\u1EEE\u1EEC\u1EF0\u1EE4\u1E72\u0172\u1E76\u1E74\u0244]/g},
    {'base':'V', 'letters':/[\u0056\u24CB\uFF36\u1E7C\u1E7E\u01B2\uA75E\u0245]/g},
    {'base':'VY','letters':/[\uA760]/g},
    {'base':'W', 'letters':/[\u0057\u24CC\uFF37\u1E80\u1E82\u0174\u1E86\u1E84\u1E88\u2C72]/g},
    {'base':'X', 'letters':/[\u0058\u24CD\uFF38\u1E8A\u1E8C]/g},
    {'base':'Y', 'letters':/[\u0059\u24CE\uFF39\u1EF2\u00DD\u0176\u1EF8\u0232\u1E8E\u0178\u1EF6\u1EF4\u01B3\u024E\u1EFE]/g},
    {'base':'Z', 'letters':/[\u005A\u24CF\uFF3A\u0179\u1E90\u017B\u017D\u1E92\u1E94\u01B5\u0224\u2C7F\u2C6B\uA762]/g},
    {'base':'a', 'letters':/[\u0061\u24D0\uFF41\u1E9A\u00E0\u00E1\u00E2\u1EA7\u1EA5\u1EAB\u1EA9\u00E3\u0101\u0103\u1EB1\u1EAF\u1EB5\u1EB3\u0227\u01E1\u00E4\u01DF\u1EA3\u00E5\u01FB\u01CE\u0201\u0203\u1EA1\u1EAD\u1EB7\u1E01\u0105\u2C65\u0250]/g},
    {'base':'aa','letters':/[\uA733]/g},
    {'base':'ae','letters':/[\u00E6\u01FD\u01E3]/g},
    {'base':'ao','letters':/[\uA735]/g},
    {'base':'au','letters':/[\uA737]/g},
    {'base':'av','letters':/[\uA739\uA73B]/g},
    {'base':'ay','letters':/[\uA73D]/g},
    {'base':'b', 'letters':/[\u0062\u24D1\uFF42\u1E03\u1E05\u1E07\u0180\u0183\u0253]/g},
    {'base':'c', 'letters':/[\u0063\u24D2\uFF43\u0107\u0109\u010B\u010D\u00E7\u1E09\u0188\u023C\uA73F\u2184]/g},
    {'base':'d', 'letters':/[\u0064\u24D3\uFF44\u1E0B\u010F\u1E0D\u1E11\u1E13\u1E0F\u0111\u018C\u0256\u0257\uA77A]/g},
    {'base':'dz','letters':/[\u01F3\u01C6]/g},
    {'base':'e', 'letters':/[\u0065\u24D4\uFF45\u00E8\u00E9\u00EA\u1EC1\u1EBF\u1EC5\u1EC3\u1EBD\u0113\u1E15\u1E17\u0115\u0117\u00EB\u1EBB\u011B\u0205\u0207\u1EB9\u1EC7\u0229\u1E1D\u0119\u1E19\u1E1B\u0247\u025B\u01DD]/g},
    {'base':'f', 'letters':/[\u0066\u24D5\uFF46\u1E1F\u0192\uA77C]/g},
    {'base':'g', 'letters':/[\u0067\u24D6\uFF47\u01F5\u011D\u1E21\u011F\u0121\u01E7\u0123\u01E5\u0260\uA7A1\u1D79\uA77F]/g},
    {'base':'h', 'letters':/[\u0068\u24D7\uFF48\u0125\u1E23\u1E27\u021F\u1E25\u1E29\u1E2B\u1E96\u0127\u2C68\u2C76\u0265]/g},
    {'base':'hv','letters':/[\u0195]/g},
    {'base':'i', 'letters':/[\u0069\u24D8\uFF49\u00EC\u00ED\u00EE\u0129\u012B\u012D\u00EF\u1E2F\u1EC9\u01D0\u0209\u020B\u1ECB\u012F\u1E2D\u0268\u0131]/g},
    {'base':'j', 'letters':/[\u006A\u24D9\uFF4A\u0135\u01F0\u0249]/g},
    {'base':'k', 'letters':/[\u006B\u24DA\uFF4B\u1E31\u01E9\u1E33\u0137\u1E35\u0199\u2C6A\uA741\uA743\uA745\uA7A3]/g},
    {'base':'l', 'letters':/[\u006C\u24DB\uFF4C\u0140\u013A\u013E\u1E37\u1E39\u013C\u1E3D\u1E3B\u017F\u0142\u019A\u026B\u2C61\uA749\uA781\uA747]/g},
    {'base':'lj','letters':/[\u01C9]/g},
    {'base':'m', 'letters':/[\u006D\u24DC\uFF4D\u1E3F\u1E41\u1E43\u0271\u026F]/g},
    {'base':'n', 'letters':/[\u006E\u24DD\uFF4E\u01F9\u0144\u00F1\u1E45\u0148\u1E47\u0146\u1E4B\u1E49\u019E\u0272\u0149\uA791\uA7A5]/g},
    {'base':'nj','letters':/[\u01CC]/g},
    {'base':'o', 'letters':/[\u006F\u24DE\uFF4F\u00F2\u00F3\u00F4\u1ED3\u1ED1\u1ED7\u1ED5\u00F5\u1E4D\u022D\u1E4F\u014D\u1E51\u1E53\u014F\u022F\u0231\u00F6\u022B\u1ECF\u0151\u01D2\u020D\u020F\u01A1\u1EDD\u1EDB\u1EE1\u1EDF\u1EE3\u1ECD\u1ED9\u01EB\u01ED\u00F8\u01FF\u0254\uA74B\uA74D\u0275]/g},
    {'base':'oi','letters':/[\u01A3]/g},
    {'base':'ou','letters':/[\u0223]/g},
    {'base':'oo','letters':/[\uA74F]/g},
    {'base':'p','letters':/[\u0070\u24DF\uFF50\u1E55\u1E57\u01A5\u1D7D\uA751\uA753\uA755]/g},
    {'base':'q','letters':/[\u0071\u24E0\uFF51\u024B\uA757\uA759]/g},
    {'base':'r','letters':/[\u0072\u24E1\uFF52\u0155\u1E59\u0159\u0211\u0213\u1E5B\u1E5D\u0157\u1E5F\u024D\u027D\uA75B\uA7A7\uA783]/g},
    {'base':'s','letters':/[\u0073\u24E2\uFF53\u00DF\u015B\u1E65\u015D\u1E61\u0161\u1E67\u1E63\u1E69\u0219\u015F\u023F\uA7A9\uA785\u1E9B]/g},
    {'base':'t','letters':/[\u0074\u24E3\uFF54\u1E6B\u1E97\u0165\u1E6D\u021B\u0163\u1E71\u1E6F\u0167\u01AD\u0288\u2C66\uA787]/g},
    {'base':'tz','letters':/[\uA729]/g},
    {'base':'u','letters':/[\u0075\u24E4\uFF55\u00F9\u00FA\u00FB\u0169\u1E79\u016B\u1E7B\u016D\u00FC\u01DC\u01D8\u01D6\u01DA\u1EE7\u016F\u0171\u01D4\u0215\u0217\u01B0\u1EEB\u1EE9\u1EEF\u1EED\u1EF1\u1EE5\u1E73\u0173\u1E77\u1E75\u0289]/g},
    {'base':'v','letters':/[\u0076\u24E5\uFF56\u1E7D\u1E7F\u028B\uA75F\u028C]/g},
    {'base':'vy','letters':/[\uA761]/g},
    {'base':'w','letters':/[\u0077\u24E6\uFF57\u1E81\u1E83\u0175\u1E87\u1E85\u1E98\u1E89\u2C73]/g},
    {'base':'x','letters':/[\u0078\u24E7\uFF58\u1E8B\u1E8D]/g},
    {'base':'y','letters':/[\u0079\u24E8\uFF59\u1EF3\u00FD\u0177\u1EF9\u0233\u1E8F\u00FF\u1EF7\u1E99\u1EF5\u01B4\u024F\u1EFF]/g},
    {'base':'z','letters':/[\u007A\u24E9\uFF5A\u017A\u1E91\u017C\u017E\u1E93\u1E95\u01B6\u0225\u0240\u2C6C\uA763]/g}
  ];

  for(var i=0; i<defaultDiacriticsRemovalMap.length; i++) {
    str = str.replace(defaultDiacriticsRemovalMap[i].letters, defaultDiacriticsRemovalMap[i].base);
  }

  return str;

}

/**
 * Returns only the matched groups given a string and a regex.
 *
 * @see         Code borrowed from {@link http://stackoverflow.com/a/14210948 this} Stack Overflow answer.
 *
 * @param       {String}    string - String to be regex matched.
 * @param       {String|RegExp} regex - The regex pattern to be matched against.
 * @param       {Number}    [index] - Index of the capturing group to be returned. Defaults to the first group.
 *
 * @returns     {Array}    An array containing all matches.
 */
// http://stackoverflow.com/a/14210948
getMatches = function( string, regex, index ) {
    index || (index = 1); // default to the first capturing group
    var matches = [];
    var match;
    while (match = regex.exec(string)) {
        matches.push(match[index]);
    }
    return matches;
}
