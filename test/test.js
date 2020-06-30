#!/usr/bin/env node

/* jslint node:true */
/* global it:false */
/* global xit:false */
/* global describe:false */
/* global before:false */
/* global after:false */

'use strict';

require('chromedriver');

var execSync = require('child_process').execSync,
    expect = require('expect.js'),
    path = require('path');

var by = require('selenium-webdriver').By,
    until = require('selenium-webdriver').until,
    Builder = require('selenium-webdriver').Builder;

describe('Application life cycle test', function () {
    this.timeout(0);

    var server, browser = new Builder().forBrowser('chrome').build();
    const username = process.env.USERNAME, password = process.env.PASSWORD;

    before(function (done) {
        var seleniumJar= require('selenium-server-standalone-jar');
        var SeleniumServer = require('selenium-webdriver/remote').SeleniumServer;
        server = new SeleniumServer(seleniumJar.path, { port: 4444 });
        server.start();

        done();
    });

    after(function (done) {
        browser.quit();
        server.stop();
        done();
    });

    var LOCATION = 'test';
    var TIMEOUT = parseInt(process.env.TIMEOUT, 10) || 10000;
    var app;
    let vault;

    function getAppInfo() {
        var inspect = JSON.parse(execSync('cloudron inspect'));
        app = inspect.apps.filter(function (a) { return a.location === LOCATION || a.location === LOCATION + '2'; })[0];
        expect(app).to.be.an('object');
    }

    function initVault(done) {
        let out = execSync('cloudron exec --app ' + app.id + ' -- vault operator init -key-shares=1 -key-threshold=1 -format=json', { encoding: 'utf8' });
        // { unseal_keys_b64: [ 'ail569sGe7eVeu7lnhjAULXI79VDjAHhGcA6K/yON7o=' ],
        //   unseal_keys_hex: [ '6a2979ebdb067bb7957aeee59e18c050b5c8efd5438c01e119c03a2bfc8e37ba' ],
        //   unseal_shares: 1,
        //   unseal_threshold: 1,
        //   recovery_keys_b64: [],
        //   recovery_keys_hex: [],
        //   recovery_keys_shares: 5,
        //   recovery_keys_threshold: 3,
        //   root_token: 's.d70U1n15etd4YCIsiU0yRjuA' }
        vault = JSON.parse(out);
        console.dir(vault);
        done();
    }

    function unsealVault(done) {
        browser.get(`https://${app.fqdn}/ui/vault/unseal`).then(function () {
            return browser.wait(until.elementLocated(by.xpath('//input[@name="key"]')), TIMEOUT);
        }).then(function () {
            return browser.sleep(2000);
        }).then(function () {
            return browser.findElement(by.xpath('//input[@name="key"]')).sendKeys(vault.unseal_keys_hex[0]);
        }).then(function () {
            return browser.findElement(by.xpath('//button[text()="Unseal"]')).click();
        }).then(function () {
            return browser.wait(until.elementLocated(by.xpath('//h1[contains(text(), "Sign in to Vault")]')), TIMEOUT);
        }).then(function () {
            done();
        });
    }

    function loginWithRootToken(done) {
        browser.get(`https://${app.fqdn}/ui/vault/auth?with=token`).then(function () {
            return browser.wait(until.elementLocated(by.xpath('//input[@name="token"]')), TIMEOUT);
        }).then(function () {
            return browser.sleep(2000);
        }).then(function () {
            return browser.findElement(by.xpath('//input[@name="token"]')).sendKeys(vault.root_token);
        }).then(function () {
            return browser.findElement(by.xpath('//button[contains(text(), "Sign In")]')).click();
        }).then(function () {
            return browser.wait(until.elementLocated(by.xpath('//h1[contains(text(), "Secrets Engines")]')), TIMEOUT);
        }).then(function () {
            done();
        });
    }

    function logout(done) {
        browser.get(`https://${app.fqdn}/ui/vault/logout`).then(function () {
            return browser.wait(until.elementLocated(by.xpath('//h1[contains(text(), "Sign in to Vault")]')), TIMEOUT);
        }).then(function () {
            done();
        });
    }

    function enableLdap(done) {
        let out = execSync(`cloudron exec --app ${app.id} -- /app/pkg/enable-ldap.sh ${vault.root_token}`, { encoding: 'utf8' });
        if (!out.includes('LDAP login enabled')) return done(new Error('Could not enable ldap:' + out));
        console.log(out);
        done();
    }

    function loginLdap(done) {
        browser.get(`https://${app.fqdn}/ui/vault/auth?with=ldap`).then(function () {
            return browser.wait(until.elementLocated(by.xpath('//h1[contains(text(), "Sign in to Vault")]')), TIMEOUT);
        }).then(function () {
            return browser.sleep(2000);
        }).then(function () {
            return browser.findElement(by.xpath('//input[@id="username"]')).sendKeys(username);
        }).then(function () {
            return browser.findElement(by.xpath('//input[@id="password"]')).sendKeys(password);
        }).then(function () {
            return browser.findElement(by.xpath('//button[contains(text(), "Sign In")]')).click();
        }).then(function () {
            return browser.wait(until.elementLocated(by.xpath('//h1[contains(text(), "Secrets Engines")]')), TIMEOUT);
        }).then(function () {
            done();
        });
    }

    xit('build app', function () {
        execSync('cloudron build', { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
    });

    it('install app', function () {
        execSync('cloudron install --location ' + LOCATION, { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
    });

    it('can get app information', getAppInfo);
    it('init vault', initVault);
    it('unseal vault', unsealVault);
    it('can sign in', loginWithRootToken);
    it('can logout', logout);
    it('enable ldap', enableLdap);
    it('can ldap login', loginLdap);
    it('can logout', logout);

    it('restart app', function () {
        execSync('cloudron restart --app ' + app.id, { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
    });
    it('unseal vault', unsealVault);
    it('can sign in', loginWithRootToken);
    it('can logout', logout);
    it('enable ldap', enableLdap);
    it('can ldap login', loginLdap);
    it('can logout', logout);

    it('backup app', function () {
        execSync('cloudron backup create --app ' + app.id, { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
    });

    it('restore app', function () {
        execSync('cloudron restore --app ' + app.id, { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
    });
    it('unseal vault', unsealVault);
    it('can sign in', loginWithRootToken);
    it('can logout', logout);
    it('enable ldap', enableLdap);
    it('can ldap login', loginLdap);
    it('can logout', logout);

    it('move to different location', function () {
        execSync('cloudron configure --location ' + LOCATION + '2 --app ' + app.id, { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
        var inspect = JSON.parse(execSync('cloudron inspect'));
        app = inspect.apps.filter(function (a) { return a.location === LOCATION + '2'; })[0];
        expect(app).to.be.an('object');
    });
    it('unseal vault', unsealVault);
    it('can sign in', loginWithRootToken);
    it('can logout', logout);
    it('enable ldap', enableLdap);
    it('can ldap login', loginLdap);
    it('can logout', logout);

    it('uninstall app', function () {
        execSync('cloudron uninstall --app ' + app.id, { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
    });

    // test update
    it('can install app', function () {
        execSync('cloudron install --appstore-id ' + app.manifest.id + ' --location ' + LOCATION, { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
    });
    it('can get app information', getAppInfo);
    it('init vault', initVault);

    it('can update', function () {
        execSync('cloudron update --app ' + app.id, { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
        var inspect = JSON.parse(execSync('cloudron inspect'));
        app = inspect.apps.filter(function (a) { return a.location === LOCATION; })[0];
        expect(app).to.be.an('object');
    });
    it('unseal vault', unsealVault);
    it('can sign in', loginWithRootToken);
    it('can logout', logout);
    it('enable ldap', enableLdap);
    it('can ldap login', loginLdap);
    it('can logout', logout);

    it('uninstall app', function () {
        execSync('cloudron uninstall --app ' + app.id, { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
    });
});
