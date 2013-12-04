okvviki = {
    
    /*
     * Properties that defines the okvviki app instance.
     * 
     * @property    {String}    domain - The domain this okvviki instance operate udner and will generate URL for.
     * @property    {String}    notebookKeyParam - The parameter name denoting notebook keys in this okvviki instance.
     * @property    {String}    pageKeyParam - The parameter name denoting page keys in this okvviki instance.
     */
    config: {
        domain: '5310.github.io/okvviki/index.html',
        notebookKeyParam: 'n',
        pageKeyParam: 'p',
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
     * @this        {Page}    The page object being created.
     * 
     * @see         
     */
    pageObject: function() {
        this.title = "";
        this.content = "";
        this.isNotebook = false;
        this.notebookPages = [];
    },
    
    /*
     * Reads the okvviki keys from the currently loaded URL's query strings.
     * 
     * It parses the properties by the given names in config.
     * 
     * @returns     {Object}    keys - Object containing parsed keys.
     * @properties  {String}    keys.notebookKey - Notebook key of the currently loaded page.
     * @properties  {String}    keys.pageKey - The key of the currently loaded page.
     * 
     * @throws      Throws an exception if there was no notebook key.
     */
    parseKeysFromURL: function() { return keys; },
    
    /*
     * Creates an URL from okvviki keys.
     * 
     * @param       {String}    pageKey - The unique key denoting the okvviki page inside its notebook.
     * @param       {String}    [notebookKey] - The unique key denoting the notebook this page belongs to. Defaults to the currently loaded notebook.
     * 
     * @returns     {String}    url - The generated okvviki URL.
     */
    // Returns an URL string.
    generatePageURL: function( pageKey, notebookKey ) { return url; },
    
    /*
     * Converts any given string to a valid key for querystring property and OKV storage.
     * 
     * @param       {String}    string - The arbitrary string to be cleaned.
     * 
     * @returns     {String}    key - The cleaned key.
     * 
     * @throws      Throws an exception if the converted key is empty.
     */
    makeValidKey: function( string ) { return key; },
    
    /*
     * Directly modifies the page's okvviki flavored Markdown in order to fill in autokeys or other macros.
     * 
     * @param       {Page}      page - The okvviki page object whose content is to be expanded.
     * 
     * @returns     {Page}      page - The given and modified page object.
     */
    expand: function( page ) { return page; },
    
    /*
     * Preprocesses a page's okvviki flavored Markdown to generate proper URLS for rendering with Markdown.
     * 
     * @param       {Page}      page - The okvviki page object whose content is to be expanded.
     * 
     * @returns     {String}    page - A standard Markdown string.
     */
    preprocess: function( page ) { return markdown; },
    
    /*
     * Renders a standard Markdown string to HTML.
     * 
     * @param       {String}    markdown - The standard Markdown string to be rendered to HTML.
     * 
     * @returns     {String}    html - The rendered HTML string.
     * 
     * @throws      Throws an exception if rendering failed.
     */
    render: function( markdown ) { return html; },
    
    /*
     * Loads an okvviki page object from OKV.
     * 
     * @param       {String}    pageKey - The unique key denoting the okvviki page inside its notebook.
     * @param       {String}    [notebookKey] - The unique key denoting the notebook this page belongs to. Defaults to the currently loaded notebook.
     * 
     * @returns     {Page}      page - The retrieved okvviki page object.
     * 
     * @throws      Throws an exception if OKV failed to retrieve the object.
     */
    loadPage: function( pageKey, notebookKey ) { return page; },
    
    /*
     * Saves an okvviki page object to OKV given the keys.
     * 
     * @param       {Page}      page - The okvviki page object being stored.
     * @param       {String}    pageKey - The unique key denoting the okvviki page inside its notebook.
     * @param       {String}    [notebookKey] - The unique key denoting the notebook this page belongs to. Defaults to the currently loaded notebook.
     * 
     * @returns     {Page}      page - The same page object that was attempted to be stored.
     * 
     * @throws      Throws an exception if OKV failed to store the object with the response.
     */
    savePage: function( page, pageKey, notebookKey ) { return page; },
    
};

/*
 * Returns the querystring value given a parameter name.
 * 
 * @param       {String}    name - The querystring parameter being retrieved.
 * 
 * @return      {String}    The value of the retrieved querystring parameter.
 */
getParameterFromURL = function( name ) {
  name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
  var regexS = "[\\?&]"+name+"=([^&#]*)";
  var regex = new RegExp( regexS );
  var results = regex.exec( window.location.href );
  if( results == null )
    return "";
  else
    return decodeURIComponent(results[1].replace(/\+/g, " "));
};

/*
 * Clones most Javascript objects.
 * 
 * @param       {Object}    object - The object to be cloned.
 * 
 * @return      {Object}    The cloned object.
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