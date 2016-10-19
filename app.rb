require 'sinatra/base'

module BasicChat
  class App < Sinatra::Base
    get '/' do
      send_file File.join(settings.public_folder, 'index.html')
    end
  end
end
