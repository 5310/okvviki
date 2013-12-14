okvviki
=======

**okvviki** is a toy wiki that uses slightly flavored [Markdown][1] for wiki-like formatting and linking and [OpenKeyval][2] for "storage".

It is not a "real" app, but rather an experiment to see how easily I can make a simple wiki-like application for spontaneous anonymous shared note-taking.

(I would like it if you pronounce it "okay-wiki" and make the 'w' sound more like a 'v'. But eh...)

Usage
-----

Just edit any page to create any links using okvviki shorthands (click the help button on the app to know how) to visit and/or edit that page. Link between pages all wiki-like, you know the drill.

The following describes what changes okvviki makes to the Markdown content for easy linking:

- If you give any Markdown link a target that isn't an url or a relative url that starts with a <code>/</code>, okvviki will assume it is a page's key, and convert it to a proper url pointing to that page.
    ```
    [link text](link page)
    is converted to
    <a href=".../index.html?p=link_page">link text</a>.
    ```
- Leaving a Markdown link empty of a target will automatically use the link-text as a page key, if the conversion is possible.
    ```
    [link text]()
    is converted to
    <a href=".../index.html?p=link_text">link text</a>.
    ```
- Instead of an url, inputting a ? will instead create a randomly generated page key upon save.
    ```
    [link text](?)
    is converted to
    <a href=".../index.html?p=123abc">link text</a>.
    ```
- And all of this is valid for refential link targets, too!

Caveats
-------

Even this particular instance of okvviki and all the pages herein can be edited anonymously and by anyone at all, and I take no responsibilities for any of the content that appears here! The index page of the demo which is usually used to link to other hub pages, will be reset upon reload though. >:D

Please note, okvviki is a simple toy app that uses [OpenKeyval][2] for storage, hence the name. [OpenKeyval][2] is a fine place for a tiny bit of experimental persistence, but it has no privacy or write-protection (while still being editable for our purposes) and absolutely no guarantees of retention. You should not use okvviki for any imporant data, that's just silly.

"Spin Your Own"
---------------

If you'd still like to use it, you can just download and host a static copy of the app anywhere and use that. Just make sure to change the config to set demo mode to false.

[1]: http://daringfireball.net/projects/markdown/syntax "Markdown Syntax Documentation"
[2]: http://openkeyval.org/ "OpenKeyval, the Completely Open Key-value Data Store"
