(function (jssn, expect) {
  describe('circular refrences', function () {
    describe('to objects', function () {
      it('remain circular', function () {
        var foo = {};
        foo.foo = foo;
        foo.bar = foo;
        var encoded = jssn.stringify(foo);
        expect(encoded).to.be('[{"foo":"c0","bar":"c0"}]');
        var decoded = jssn.parse(encoded);
        expect(decoded.foo).to.be(decoded);
        expect(decoded.bar).to.be(decoded);
        expect(decoded.foo).to.be(decoded.bar);
      });
    });
    describe('to Arrays', function () {
      it('remain circular', function () {
        var foo = [null, null];
        foo[0] = foo;
        foo[1] = foo;
        var encoded = jssn.stringify(foo);
        expect(encoded).to.be('[["c0","c0"]]');
        var decoded = jssn.parse(encoded);
        expect(decoded).to.be.an(Array);
        expect(decoded[0]).to.be(decoded);
        expect(decoded[1]).to.be(decoded);
        expect(decoded[0]).to.be(decoded[1]);
      });
    });
  });
  describe('regular-expressions', function () {
    var reg = /^\-$/;
    it('gets passed through if it\'s the root', function () {
      var encoded = jssn.stringify(reg);
      expect(encoded).to.be('["r/^\\\\-$/"]');
      var decoded = jssn.parse(encoded);
      expect(decoded).to.be.a(RegExp);
      expect(decoded.test('-')).to.be.ok();
      expect(decoded.test('#')).to.not.be.ok();
    });
    it('gets passed through if it\'s not the root', function () {
      var encoded = jssn.stringify({r: reg});
      expect(encoded).to.be('[{"r":"r/^\\\\-$/"}]');
      var decoded = jssn.parse(encoded).r;
      expect(decoded).to.be.a(RegExp);
      expect(decoded.test('-')).to.be.ok();
      expect(decoded.test('#')).to.not.be.ok();
    });
  });

  describe('dates', function () {
    var date = new Date(1354804160445);
    it('gets passed through if it\'s the root', function () {
      var encoded = jssn.stringify(date);
      expect(encoded).to.be('["d1354804160445"]');
      var decoded = jssn.parse(encoded);
      expect(decoded).to.be.a(Date);
      expect(decoded.toString()).to.be(date.toString());
    });
    it('gets passed through if it\'s not the root', function () {
      var encoded = jssn.stringify({d: date});
      expect(encoded).to.be('[{"d":"d1354804160445"}]');
      var decoded = jssn.parse(encoded).d;
      expect(decoded).to.be.a(Date);
      expect(decoded.toString()).to.be(date.toString());
    });
  });
  describe('functions', function () {
    it('are passed through as source code', function () {
      function fn() { return 42; }
      var encoded = jssn.stringify(fn);
      var decoded = jssn.parse(encoded);
      expect(decoded).to.be.a('function');
      expect(decoded()).to.be(42);
    });
    it('are not duplicated', function () {
      function fn() { return 42; }
      var encoded = jssn.stringify({a: fn, b: fn});
      var decoded = jssn.parse(encoded);
      expect(decoded.a).to.be.a('function');
      expect(decoded.b).to.be.a('function');
      expect(decoded.a).to.be(decoded.b);
      expect(decoded.a()).to.be(42);
      expect(decoded.b()).to.be(42);
    });

    it('do not keep variables from the closure :(', function () {
      var value = 42;
      function fn() { return value; }
      var encoded = jssn.stringify(fn);
      var decoded = jssn.parse(encoded);
      expect(decoded).to.be.a('function');
      expect(decoded).to.throwError();
    });
  });

  describe('Arguments', function () {
    it('are treated as Arrays', function () {
      function getSerialized() {
        return jssn.stringify(arguments);
      }
      var encoded = getSerialized('foo', 'bar');
      expect(encoded).to.be('[["sfoo","sbar"]]');
      var decoded = jssn.parse(encoded);
      expect(decoded).to.be.an(Array);
      expect(decoded[0]).to.be('foo');
      expect(decoded[1]).to.be('bar');
    });
  });

  describe('classes', function () {
    it('can maintain prototypes', function () {
      var protos = {};
      protos['Construction'] = Construction;
      function Construction(val) {
        this.val = val;
      }
      Construction.prototype.foo = function () { return this.val; };
      var encoded = jssn.stringify(new Construction(42));
      expect(encoded).to.be('[{"_jssn_proto":"Construction","val":42}]');
      var decoded = jssn.parse(encoded, protos);
      expect(decoded).to.be.a(Construction);
      expect(decoded.foo()).to.be(42);
      encoded = jssn.stringify(decoded);
      expect(encoded).to.be('[{"_jssn_proto":"Construction","val":42}]');
      var decoded = jssn.parse(encoded, protos);
      expect(decoded).to.be.a(Construction);
      expect(decoded.foo()).to.be(42);
    });
  });
}(getJSSN(), getExpect()));

function getExpect() {
  return typeof expect === 'function' ? expect : require('expect.js');
}
function getJSSN() {
  if (typeof jssn != 'undefined' && jssn) {
    return jssn;
  } else {
    try {
      return require('jssn');
    } catch (ex) {
      return require('../');
    }
  }
}