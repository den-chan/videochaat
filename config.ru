$stdout.sync = true

require './app'
require './backend'
use BasicChat::Backend

require 'rack/ssl-enforcer'
use Rack::SslEnforcer

run BasicChat::App
