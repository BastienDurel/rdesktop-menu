/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Panel = imports.ui.panel;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const RDSK_ICON_SIZE = 22;

const RDesktopMenu = new Lang.Class({
    Name: 'RDesktopMenu.RDesktopMenu',
    Extends: PanelMenu.SystemStatusButton,

    _init: function() {
        this.parent('server');
        this.items = [];
        this._createItems();
        this.setName("RDP");
        this.setIcon('network-workgroup-symbolic');
    },

    destroy: function() {
        this.parent();
    },

    _createItems: function() {
        // TODO: seek in $HOME/.grdesktop ; use ini-files
        this.conf = [{
                      name: "devsrv2",
                      run: "/home/bastien/.grdesktop/devsrv2.conf"
                    },
                    {
                      name: "ICRC",
                      run: "/home/bastien/.grdesktop/icrc.conf"
                    }];

        for (let srvid = 0; srvid < this.conf.length; srvid++) {
            this.items[srvid] = new PopupMenu.PopupMenuItem(this.conf[srvid].name);
            //let icon = this.devices[srvid].iconFactory(RDSK_ICON_SIZE);
            let icon = new St.Icon({icon_size: RDSK_ICON_SIZE, 
                                    icon_type: St.IconType.FULLCOLOR, 
                                    icon_name: 'network-server-symbolic'});
            this.items[srvid].addActor(icon, { align: St.Align.END });
            this.items[srvid].conf = this.conf[srvid];
            this.menu.addMenuItem(this.items[srvid]);
            this.items[srvid].connect('activate', function(actor,event) {
                try {
                    GLib.spawn_command_line_async(actor.conf.run);
                }
                catch (err) {
                    Main.notifyError('Error', err.message);
                }
            });
        }

    }

});

function init() {
    //Convenience.initTranslations();
}

let _indicator;

function enable() {
    _indicator = new RDesktopMenu;
    global.log(_indicator);
    Main.panel._rdpindicator = _indicator;
    Main.panel.addToStatusArea('rdesktop-menu', _indicator);
}

function disable() {
    _indicator.destroy();
    Main.panel._rdpindicator = null;
}

